import re

from django import forms
from django.contrib import admin
from django.utils.html import format_html
from .models import IssueNote, IssueNoteAttachment, Project, Tag, Task, TaskAssignee, TaskCategory


class IssueNoteAttachmentInline(admin.TabularInline):
    model = IssueNoteAttachment
    extra = 0
    readonly_fields = ("original_name", "file_size", "uploaded_by", "created_at")


@admin.register(IssueNote)
class IssueNoteAdmin(admin.ModelAdmin):
    list_display = ("title", "reported_by_name", "status", "created_by", "created_at", "resolved_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "content", "reported_by_name")
    readonly_fields = ("created_at", "updated_at", "resolved_at")
    inlines = (IssueNoteAttachmentInline,)


class ColorCodeWidget(forms.TextInput):
    def render(self, name, value, attrs=None, renderer=None):
        attrs = attrs or {}
        input_id = attrs.get("id", f"id_{name}")
        picker_id = f"{input_id}_picker"
        color = value if isinstance(value, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", value) else "#2874C7"
        text_input = super().render(
            name,
            color.upper(),
            {**attrs, "class": f"{attrs.get('class', '')} color-code-input".strip(), "maxlength": "7"},
            renderer,
        )
        return format_html(
            '<span class="color-picker-field">'
            '<input id="{}" class="color-visual-picker" type="color" value="{}" '
            'oninput="document.getElementById(\'{}\').value=this.value.toUpperCase()">'
            '{}<span class="color-preview" style="background:{}"></span></span>'
            '<script>(function(){{const t=document.getElementById(\'{}\'),p=document.getElementById(\'{}\');'
            'if(!t||!p)return;t.addEventListener(\'input\',function(){{if(/^#[0-9a-fA-F]{{6}}$/.test(this.value))'
            '{{p.value=this.value;this.nextElementSibling.style.background=this.value;}}}});}})();</script>',
            picker_id, color, input_id, text_input, color, input_id, picker_id,
        )


class TagAdminForm(forms.ModelForm):
    color = forms.CharField(label="顏色", widget=ColorCodeWidget, initial="#2874C7")

    class Meta:
        model = Tag
        fields = "__all__"

    def clean_color(self):
        color = self.cleaned_data["color"].strip().upper()
        if not re.fullmatch(r"#[0-9A-F]{6}", color):
            raise forms.ValidationError("請輸入有效色碼，例如 #2874C7。")
        return color


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "owner_department", "manager", "status", "start_date", "due_date")
    list_filter = ("status", "owner_department")
    search_fields = ("name", "description")


@admin.register(TaskCategory)
class TaskCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    form = TagAdminForm
    list_display = ("name", "color_swatch", "color", "is_active")
    list_editable = ("color", "is_active")

    def get_changelist_form(self, request, **kwargs):
        return TagAdminForm

    @admin.display(description="顏色預覽")
    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:8px">'
            '<i style="display:inline-block;width:28px;height:20px;border-radius:5px;'
            'border:1px solid #AEB8C3;background:{}"></i><b style="color:{}">●</b></span>',
            obj.color, obj.color,
        )

    class Media:
        css = {"all": ("css/admin-color-picker.css",)}


class TaskAssigneeInline(admin.TabularInline):
    model = TaskAssignee
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("task_no", "title", "owner_department", "primary_assignee", "priority", "status", "progress", "due_date")
    list_filter = ("status", "priority", "category", "owner_department")
    search_fields = ("task_no", "title", "description")
    readonly_fields = ("task_no", "completed_at", "created_at", "updated_at")
    inlines = (TaskAssigneeInline,)
