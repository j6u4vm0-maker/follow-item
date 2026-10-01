from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "unit_type", "parent", "display_path", "is_active")
    list_filter = ("unit_type", "is_active")
    search_fields = ("code", "name", "parent__name")
    ordering = ("unit_type", "code")
    autocomplete_fields = ("parent",)

    @admin.display(description="完整組織路徑")
    def display_path(self, obj):
        return obj.hierarchy_path
