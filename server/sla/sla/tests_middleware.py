"""CORS behaviour, focused on the ways credentialed CORS goes wrong.

The dangerous failure is not "requests are blocked" — that is loud and gets
fixed. It is an origin being reflected back with `Allow-Credentials: true`,
which lets any site make authenticated requests as the logged-in admin and read
the answers, while looking entirely functional from the inside.
"""

from __future__ import annotations

from django.test import TestCase, override_settings

ALLOWED = "http://localhost:5173"
HOSTILE = "http://evil.example"


@override_settings(CORS_ALLOWED_ORIGINS=[ALLOWED])
class CorsTests(TestCase):
    def test_allowed_origin_gets_credentialed_headers(self):
        response = self.client.get("/api/user/", HTTP_ORIGIN=ALLOWED)
        self.assertEqual(response["Access-Control-Allow-Origin"], ALLOWED)
        self.assertEqual(response["Access-Control-Allow-Credentials"], "true")

    def test_unlisted_origin_is_not_reflected(self):
        """The one that matters: never echo an arbitrary Origin."""
        response = self.client.get("/api/user/", HTTP_ORIGIN=HOSTILE)
        self.assertNotIn("Access-Control-Allow-Origin", response)
        self.assertNotIn("Access-Control-Allow-Credentials", response)

    def test_no_wildcard_is_ever_sent(self):
        response = self.client.get("/api/user/", HTTP_ORIGIN=ALLOWED)
        self.assertNotEqual(response.get("Access-Control-Allow-Origin"), "*")

    def test_vary_origin_is_always_set(self):
        """Or a cache serves one origin's permissive response to another."""
        for origin in (ALLOWED, HOSTILE):
            response = self.client.get("/api/user/", HTTP_ORIGIN=origin)
            self.assertIn("Origin", response["Vary"])

    def test_preflight_from_allowed_origin_succeeds(self):
        response = self.client.options(
            "/api/admin/knowledge/",
            HTTP_ORIGIN=ALLOWED,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )
        self.assertEqual(response.status_code, 204)
        self.assertIn("X-CSRFToken", response["Access-Control-Allow-Headers"])

    def test_preflight_from_hostile_origin_is_refused(self):
        response = self.client.options(
            "/api/admin/knowledge/",
            HTTP_ORIGIN=HOSTILE,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("Access-Control-Allow-Origin", response)

    def test_cors_headers_present_on_an_auth_failure(self):
        """A 401 without CORS headers reaches the SPA as an opaque network error."""
        response = self.client.get("/api/admin/dashboard/", HTTP_ORIGIN=ALLOWED)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["Access-Control-Allow-Origin"], ALLOWED)
