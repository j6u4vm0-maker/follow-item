from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path
from django.views.generic import RedirectView

from accounts.forms import TraditionalChineseAuthenticationForm
from accounts.views import DashboardView, healthcheck

urlpatterns = [
    path("admin/", RedirectView.as_view(pattern_name="organization_chart", permanent=False)),
    path("admin/", admin.site.urls),
    path("health/", healthcheck, name="healthcheck"),
    path("", DashboardView.as_view(), name="dashboard"),
    path(
        "login/",
        auth_views.LoginView.as_view(
            template_name="registration/login.html",
            authentication_form=TraditionalChineseAuthenticationForm,
        ),
        name="login",
    ),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("password/", include("accounts.urls")),
    path("accounts/", include("accounts.management_urls")),
    path("tasks/", include("workitems.urls")),
    path("organization/", include("organization.urls")),
]
