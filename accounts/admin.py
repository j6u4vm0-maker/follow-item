from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class DepartmentUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("部門工作追蹤", {"fields": ("display_name", "department", "role")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("部門工作追蹤", {"fields": ("display_name", "department", "role", "is_active")}),
    )
    list_display = ("username", "display_name", "department", "role", "is_active", "is_staff")
    list_filter = ("role", "department", "is_active", "is_staff")
    search_fields = ("username", "display_name", "email")

