from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.urls import reverse_lazy
from django.views.generic import CreateView, TemplateView, UpdateView

from accounts.models import User
from .forms import DepartmentForm, OrganizationUserForm
from .models import Department


class StaffRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_staff or self.request.user.role == User.Role.ADMIN


class OrganizationChartView(LoginRequiredMixin, TemplateView):
    template_name = "organization/chart.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        departments = list(
            Department.objects.filter(is_active=True)
            .select_related("parent")
            .prefetch_related("members")
            .order_by("code")
        )
        children = {}
        for department in departments:
            children.setdefault(department.parent_id, []).append(department)

        rows = []

        def add_department(department, depth=0):
            rows.append({"kind": "department", "item": department, "depth": depth})
            for member in department.members.filter(is_active=True).order_by("display_name", "username"):
                if member.role == member.Role.MANAGER:
                    title = {Department.UnitType.SECTION: "課長", Department.UnitType.GROUP: "組長"}.get(department.unit_type, "主管")
                else:
                    title = "工程師/專員"
                rows.append({"kind": "person", "item": member, "depth": depth + 1, "title": title})
            for child in children.get(department.pk, []):
                add_department(child, depth + 1)

        for root in children.get(None, []):
            add_department(root)
        context["organization_rows"] = rows
        return context


class OrganizationFormContextMixin:
    template_name = "organization/item_form.html"
    success_url = reverse_lazy("organization_chart")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["item_type"] = self.item_type
        context["editing"] = bool(getattr(self, "object", None) and self.object.pk)
        context["selected_department_id"] = self.request.GET.get("department", "")
        return context


class DepartmentCreateView(StaffRequiredMixin, OrganizationFormContextMixin, CreateView):
    model = Department
    form_class = DepartmentForm
    item_type = "department"


class DepartmentUpdateView(StaffRequiredMixin, OrganizationFormContextMixin, UpdateView):
    model = Department
    form_class = DepartmentForm
    item_type = "department"


class OrganizationUserCreateView(StaffRequiredMixin, OrganizationFormContextMixin, CreateView):
    model = User
    form_class = OrganizationUserForm
    item_type = "person"

    def get_initial(self):
        initial = super().get_initial()
        department_id = self.request.GET.get("department")
        if department_id and Department.objects.filter(pk=department_id, is_active=True).exists():
            initial["department"] = department_id
        return initial


class OrganizationUserUpdateView(StaffRequiredMixin, OrganizationFormContextMixin, UpdateView):
    model = User
    form_class = OrganizationUserForm
    item_type = "person"
