from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Enquiry

admin.site.register(CustomUser, UserAdmin)

@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'matter', 'status', 'created_at')
    list_filter = ('status', 'matter', 'created_at')
    search_fields = ('name', 'email', 'phone', 'message', 'matter')
    ordering = ('-created_at',)


