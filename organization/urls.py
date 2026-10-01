from django.urls import path

from .views import DepartmentCreateView, DepartmentUpdateView, OrganizationChartView, OrganizationUserCreateView, OrganizationUserUpdateView

urlpatterns = [
    path("", OrganizationChartView.as_view(), name="organization_chart"),
    path("new/", DepartmentCreateView.as_view(), name="department_create"),
    path("new/person/", OrganizationUserCreateView.as_view(), name="organization_user_create"),
    path("department/<int:pk>/edit/", DepartmentUpdateView.as_view(), name="department_update"),
    path("person/<int:pk>/edit/", OrganizationUserUpdateView.as_view(), name="organization_user_update"),
]
