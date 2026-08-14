import json
from django.http import JsonResponse
from django.views import View
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils.decorators import method_decorator

User = get_user_model()

@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFToken(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({'success': 'CSRF cookie set'})

class LoginView(View):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return JsonResponse({'success': 'Logged in successfully'}, status=200)
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=401)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

class LogoutView(View):
    def post(self, request, *args, **kwargs):
        logout(request)
        return JsonResponse({'success': 'Logged out successfully'}, status=200)

class UserView(View):
    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            # We don't need select_related for profile anymore since it's on the user model directly.
            # We still prefetch groups for optimization.
            user = User.objects.prefetch_related('groups').get(id=request.user.id)
            
            groups = [group.name for group in user.groups.all()]
            
            return JsonResponse({
                'is_authenticated': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'bio': user.bio,
                    'phone_number': user.phone_number,
                    'groups': groups
                }
            }, status=200)
        else:
            return JsonResponse({'is_authenticated': False, 'error': 'Not logged in'}, status=401)

