"""A deliberately strict CORS middleware for the admin SPA.

`django-cors-headers` would do this too, and is the right answer for a project
that needs the full matrix. This one needs one thing — let a named admin origin
send credentialed requests — and that is forty lines, so the dependency does
not earn its place here (§48).

Written strictly on purpose, because credentialed CORS is the configuration
where a permissive default is genuinely dangerous:

* **The origin is echoed only if it is on the allow-list**, never reflected
  blindly. Reflecting whatever `Origin` arrives, with
  `Allow-Credentials: true`, lets any site on the internet make authenticated
  requests as the logged-in admin and read the responses. It is the single
  worst CORS misconfiguration and it looks like it is working.
* **No wildcard.** `Access-Control-Allow-Origin: *` is void with credentials
  anyway; browsers reject the pair. Being explicit avoids a config that appears
  to permit everything and in fact permits nothing.
* **`Vary: Origin` is always set**, so a cache cannot serve one origin's
  permissive response to another.

The allow-list is the same setting Django already uses for CSRF trusted
origins, so the two cannot drift into disagreeing about which front end is
trusted.
"""

from __future__ import annotations

from django.conf import settings
from django.http import HttpResponse

# Only what the admin SPA actually sends. X-CSRFToken is the one that matters:
# without it in the allow-list the browser blocks every unsafe request, and the
# failure looks like a CSRF bug rather than a CORS one.
ALLOWED_HEADERS = "Content-Type, X-CSRFToken, X-Requested-With"
ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS"
PREFLIGHT_MAX_AGE = "3600"


class CorsMiddleware:
    """Adds CORS headers for allow-listed origins, and answers preflights."""

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _allowed() -> list[str]:
        # Reuses CSRF_TRUSTED_ORIGINS so one list governs both. A front end
        # trusted to POST is exactly the front end that needs CORS, and keeping
        # two lists is how they end up disagreeing.
        configured = list(getattr(settings, "CORS_ALLOWED_ORIGINS", []) or [])
        return configured or list(getattr(settings, "CSRF_TRUSTED_ORIGINS", []) or [])

    def __call__(self, request):
        origin = request.headers.get("Origin", "")
        permitted = bool(origin) and origin in self._allowed()

        # Answered here rather than passed down: a preflight carries no session
        # and no CSRF token, so letting it reach a protected view would produce
        # a 401 that the browser reports as an opaque CORS failure.
        if request.method == "OPTIONS" and request.headers.get("Access-Control-Request-Method"):
            response = HttpResponse(status=204 if permitted else 403)
        else:
            response = self.get_response(request)

        # Set unconditionally: the response differs by Origin whether or not
        # this particular one was allowed, and a cache must not reuse it.
        response["Vary"] = (
            f"{response['Vary']}, Origin" if response.has_header("Vary") else "Origin"
        )

        if permitted:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = ALLOWED_METHODS
            response["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
            response["Access-Control-Max-Age"] = PREFLIGHT_MAX_AGE

        return response
