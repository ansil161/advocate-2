import json
from functools import wraps
from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django.contrib.auth import authenticate, get_user_model
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils.decorators import method_decorator
from .jwt_utils import generate_jwt_token, get_user_from_jwt

User = get_user_model()

@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFToken(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({'success': 'CSRF cookie set'})

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    def post(self, request, *args, **kwargs):

        try:
            data = json.loads(request.body or '{}')
            username = data.get('username')
            password = data.get('password')
            
            user = authenticate(request, username=username, password=password)
            if user is not None:
                token = generate_jwt_token(user)
                response = JsonResponse({
                    'success': 'Logged in successfully',
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'is_staff': user.is_staff
                    }
                }, status=200)

                # Store JWT in HttpOnly Cookie
                response.set_cookie(
                    key='access_token',
                    value=token,
                    httponly=True,
                    samesite='Lax',
                    secure=not settings.DEBUG,
                    max_age=24 * 3600
                )
                return response
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=401)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(View):
    def post(self, request, *args, **kwargs):

        response = JsonResponse({'success': 'Logged out successfully'}, status=200)
        response.delete_cookie('access_token')
        return response

class UserView(View):
    def get(self, request, *args, **kwargs):
        user = get_user_from_jwt(request) or (request.user if request.user.is_authenticated else None)
        if user:
            groups = [group.name for group in user.groups.all()]
            return JsonResponse({
                'is_authenticated': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'bio': getattr(user, 'bio', ''),
                    'phone_number': getattr(user, 'phone_number', ''),
                    'groups': groups
                }
            }, status=200)
        else:
            return JsonResponse({'is_authenticated': False, 'error': 'Not logged in'}, status=401)


from django.db.models import Q, Count
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from .models import Enquiry

def admin_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        user = get_user_from_jwt(request) or (request.user if request.user.is_authenticated else None)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        if not user.is_staff:
            return JsonResponse({"error": "Administrator access required"}, status=403)
        request.user = user
        return view(request, *args, **kwargs)
    return wrapper



def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _serialize_enquiry(enquiry):
    return {
        'id': enquiry.id,
        'name': enquiry.name,
        'phone': enquiry.phone,
        'email': enquiry.email,
        'matter': enquiry.matter,
        'message': enquiry.message,
        'status': enquiry.status,
        'ip_address': enquiry.ip_address,
        'created_at': enquiry.created_at.isoformat() if enquiry.created_at else None,
        'updated_at': enquiry.updated_at.isoformat() if enquiry.updated_at else None,
    }


@method_decorator(csrf_exempt, name='dispatch')
class PublicEnquirySubmitView(View):
    def post(self, request, *args, **kwargs):
        try:
            try:
                data = json.loads(request.body or '{}')
            except json.JSONDecodeError:
                data = request.POST.dict()

            name = (data.get('name') or '').strip()
            phone = (data.get('phone') or '').strip()
            email = (data.get('email') or '').strip()
            matter = (data.get('matter') or '').strip()
            message = (data.get('message') or '').strip()

            errors = {}
            if not name:
                errors['name'] = 'Full name is required.'
            elif len(name) > 200:
                errors['name'] = 'Name cannot exceed 200 characters.'

            if not phone:
                errors['phone'] = 'Phone number is required.'

            if not email:
                errors['email'] = 'Email address is required.'
            else:
                try:
                    validate_email(email)
                except ValidationError:
                    errors['email'] = 'Please enter a valid email address.'

            if not matter:
                errors['matter'] = 'Matter type is required.'

            if not message:
                errors['message'] = 'Message description is required.'
            elif len(message) > 5000:
                errors['message'] = 'Message cannot exceed 5000 characters.'

            if errors:
                return JsonResponse({'error': 'Validation failed', 'fields': errors}, status=422)

            ip = _get_client_ip(request)
            enquiry = Enquiry.objects.create(
                name=name,
                phone=phone,
                email=email,
                matter=matter,
                message=message,
                status='new',
                ip_address=ip,
            )

            return JsonResponse({
                'success': True,
                'message': 'Your enquiry has been received successfully.',
                'enquiry': _serialize_enquiry(enquiry)
            }, status=201)

        except Exception as e:
            return JsonResponse({'error': f'Failed to process enquiry: {str(e)}'}, status=500)


@method_decorator(admin_required, name='dispatch')
class AdminEnquiryListView(View):
    def get(self, request, *args, **kwargs):
        qs = Enquiry.objects.all()

        status_filter = request.GET.get('status', '').strip()
        if status_filter in ['new', 'contacted', 'resolved', 'archived']:
            qs = qs.filter(status=status_filter)

        q = request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(email__icontains=q) |
                Q(phone__icontains=q) |
                Q(matter__icontains=q) |
                Q(message__icontains=q)
            )

        # Pagination
        try:
            page = max(1, int(request.GET.get('page', 1)))
        except ValueError:
            page = 1
        page_size = 25
        total_count = qs.count()

        items = list(qs[(page - 1) * page_size : page * page_size])

        # Calculate counts per status for admin tabs/metrics
        counts_raw = Enquiry.objects.values('status').annotate(total=Count('id'))
        counts_map = {item['status']: item['total'] for item in counts_raw}
        summary_counts = {
            'total': Enquiry.objects.count(),
            'new': counts_map.get('new', 0),
            'contacted': counts_map.get('contacted', 0),
            'resolved': counts_map.get('resolved', 0),
            'archived': counts_map.get('archived', 0),
        }

        return JsonResponse({
            'enquiries': [_serialize_enquiry(e) for e in items],
            'page': page,
            'page_size': page_size,
            'total': total_count,
            'has_more': page * page_size < total_count,
            'counts': summary_counts,
        }, status=200)


@method_decorator(admin_required, name='dispatch')
class AdminEnquiryDetailView(View):
    def get(self, request, pk, *args, **kwargs):
        try:
            enquiry = Enquiry.objects.get(pk=pk)
            return JsonResponse({'enquiry': _serialize_enquiry(enquiry)}, status=200)
        except Enquiry.DoesNotExist:
            return JsonResponse({'error': 'Enquiry not found'}, status=404)

    def patch(self, request, pk, *args, **kwargs):
        try:
            enquiry = Enquiry.objects.get(pk=pk)
            data = json.loads(request.body or '{}')
            new_status = data.get('status')
            if new_status:
                if new_status not in ['new', 'contacted', 'resolved', 'archived']:
                    return JsonResponse({'error': 'Invalid status value'}, status=422)
                enquiry.status = new_status

            enquiry.save()
            return JsonResponse({'success': True, 'enquiry': _serialize_enquiry(enquiry)}, status=200)
        except Enquiry.DoesNotExist:
            return JsonResponse({'error': 'Enquiry not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    def delete(self, request, pk, *args, **kwargs):
        try:
            enquiry = Enquiry.objects.get(pk=pk)
            enquiry.delete()
            return JsonResponse({'success': True}, status=200)
        except Enquiry.DoesNotExist:
            return JsonResponse({'error': 'Enquiry not found'}, status=404)


