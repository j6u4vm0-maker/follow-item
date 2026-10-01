from django.contrib.auth import views as auth_views
from django.urls import path

urlpatterns = [
    path(
        "change/",
        auth_views.PasswordChangeView.as_view(
            template_name="registration/password_change_form.html",
            success_url="/password/change/done/",
        ),
        name="password_change",
    ),
    path(
        "change/done/",
        auth_views.PasswordChangeDoneView.as_view(
            template_name="registration/password_change_done.html"
        ),
        name="password_change_done",
    ),
]

