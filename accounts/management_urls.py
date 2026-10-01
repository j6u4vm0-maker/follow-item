from django.urls import path

from .views import AccountCredentialUpdateView, AccountManagementView

urlpatterns = [
    path("", AccountManagementView.as_view(), name="account_management"),
    path("<int:pk>/edit/", AccountCredentialUpdateView.as_view(), name="account_credential_update"),
]
