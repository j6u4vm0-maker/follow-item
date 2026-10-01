from django.test import TestCase
from django.urls import reverse
from organization.models import Department
from .models import User


class UserModelTests(TestCase):
    def test_roles_are_available(self):
        values = {value for value, _ in User.Role.choices}
        self.assertEqual(values, {"admin", "manager", "user", "viewer"})

    def test_department_is_protected_when_user_exists(self):
        department = Department.objects.create(code="QA", name="品質保證")
        User.objects.create_user("member", "member@example.com", "Strong-pass-123", display_name="測試人員", department=department)
        with self.assertRaises(Exception):
            department.delete()


class AuthenticationTests(TestCase):
    def test_inactive_user_cannot_login(self):
        User.objects.create_user("inactive", password="Strong-pass-123", display_name="停用帳號", is_active=False)
        self.assertFalse(self.client.login(username="inactive", password="Strong-pass-123"))

    def test_dashboard_requires_login(self):
        response = self.client.get(reverse("dashboard"))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('dashboard')}")

    def test_authenticated_user_can_view_dashboard(self):
        user = User.objects.create_user("active", password="Strong-pass-123", display_name="測試人員")
        self.client.force_login(user)
        self.assertEqual(self.client.get(reverse("dashboard")).status_code, 200)

