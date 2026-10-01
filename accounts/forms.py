from django import forms
from django.contrib.auth.forms import AuthenticationForm

from .models import User


class AccountCredentialForm(forms.ModelForm):
    new_password = forms.CharField(label="新登入密碼", required=False, widget=forms.PasswordInput, help_text="留空代表保留目前密碼。")
    confirm_password = forms.CharField(label="確認新密碼", required=False, widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ["username"]

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("new_password") != cleaned.get("confirm_password"):
            self.add_error("confirm_password", "兩次輸入的密碼不一致。")
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        if self.cleaned_data.get("new_password"):
            user.set_password(self.cleaned_data["new_password"])
        if commit:
            user.save()
        return user


class TraditionalChineseAuthenticationForm(AuthenticationForm):
    error_messages = {
        "invalid_login": "帳號或密碼不正確，請再試一次。",
        "inactive": "此帳號已停用，請聯絡系統管理員。",
    }

    def confirm_login_allowed(self, user):
        if not user.is_active:
            raise self.get_invalid_login_error()
