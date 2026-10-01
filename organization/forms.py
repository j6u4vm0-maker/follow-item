from django import forms
from uuid import uuid4

from accounts.models import User
from .models import Department


class DepartmentForm(forms.ModelForm):
    class Meta:
        model = Department
        fields = ["code", "name", "unit_type", "parent", "is_active"]
        widgets = {
            "code": forms.TextInput(attrs={"placeholder": "例如：QST-QT"}),
            "name": forms.TextInput(attrs={"placeholder": "例如：品質技術組"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        queryset = Department.objects.filter(is_active=True)
        if self.instance.pk:
            queryset = queryset.exclude(pk=self.instance.pk)
        self.fields["parent"].queryset = queryset
        self.fields["parent"].required = False
        self.fields["parent"].help_text = "總部不需選擇；其他層級請選擇上一級單位。"


class OrganizationUserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["display_name", "department", "role", "is_active"]

    def save(self, commit=True):
        user = super().save(commit=False)
        if not user.pk:
            user.username = f"person_{uuid4().hex[:10]}"
            user.set_unusable_password()
        if commit:
            user.save()
        return user
