from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from django.urls import reverse_lazy
from django.views.generic import ListView, TemplateView, UpdateView

from .forms import AccountCredentialForm
from .models import User


def healthcheck(request):
    return JsonResponse({"status": "ok"})


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "dashboard.html"

    def get_context_data(self, **kwargs):
        from workitems.models import IssueNote, Meeting, MeetingItem, Project, Task
        from workitems.permissions import department_scope_ids, visible_tasks

        context = super().get_context_data(**kwargs)
        tasks = visible_tasks(
            self.request.user,
            Task.objects.select_related("primary_assignee", "owner_department", "project", "category"),
        )
        today = timezone.localdate()
        week_start = today - timezone.timedelta(days=today.weekday())
        week_end = week_start + timezone.timedelta(days=6)
        soon_end = today + timezone.timedelta(days=7)
        open_statuses = [Task.Status.NOT_STARTED, Task.Status.IN_PROGRESS, Task.Status.WAITING]
        open_tasks = tasks.filter(status__in=open_statuses)
        today_tasks = open_tasks.filter(due_date=today).order_by("-priority", "title")
        week_tasks = open_tasks.filter(due_date__gt=today, due_date__lte=week_end).order_by("due_date", "-priority")
        overdue_tasks = open_tasks.filter(due_date__lt=today).order_by("due_date", "-priority")
        soon_tasks = open_tasks.filter(due_date__gte=today, due_date__lte=soon_end)
        month_start = today.replace(day=1)
        completed_this_month = tasks.filter(
            status=Task.Status.COMPLETED,
            completed_at__date__gte=month_start,
            completed_at__date__lte=today,
        )

        projects = Project.objects.select_related("owner_department", "manager").exclude(status=Project.Status.COMPLETED)
        user = self.request.user
        if not (user.is_superuser or user.role == User.Role.ADMIN):
            visible_project_ids = tasks.exclude(project=None).values("project_id")
            project_filter = Q(created_by=user) | Q(manager=user) | Q(id__in=visible_project_ids)
            if user.role == User.Role.MANAGER and user.department_id:
                project_filter |= Q(owner_department_id__in=department_scope_ids(user.department))
            projects = projects.filter(project_filter).distinct()
        projects = projects.order_by("due_date", "name")

        meetings = Meeting.objects.select_related("series", "chair").exclude(status=Meeting.Status.COMPLETED)
        today_meetings = meetings.filter(scheduled_at__date=today).order_by("scheduled_at")
        week_meetings = meetings.filter(scheduled_at__date__gt=today, scheduled_at__date__lte=week_end).order_by("scheduled_at")

        followups = MeetingItem.objects.filter(
            carry_to_next=True, due_date__isnull=False, task__isnull=True,
        ).exclude(next_action="").select_related("meeting", "meeting__series", "owner", "task")
        visible_task_ids = tasks.values("pk")
        followups = followups.filter(Q(owner=user) | Q(task_id__in=visible_task_ids) | Q(meeting__chair=user) | Q(meeting__recorder=user)).distinct()
        today_followups = followups.filter(due_date=today).order_by("meeting__scheduled_at", "order")
        week_followups = followups.filter(due_date__gt=today, due_date__lte=week_end).order_by("due_date", "meeting__scheduled_at")

        open_notes = IssueNote.objects.exclude(status=IssueNote.Status.DONE).select_related("created_by").order_by("status", "-updated_at")
        context["metrics"] = [
            {"label": "我的未完成", "value": open_tasks.count(), "tone": "blue", "hint": "依你的可見範圍"},
            {"label": "即將到期", "value": soon_tasks.count(), "tone": "amber", "hint": f"今天至 {soon_end:%m/%d}"},
            {"label": "已逾期", "value": overdue_tasks.count(), "tone": "red", "hint": "尚未完成"},
            {"label": "本月完成", "value": completed_this_month.count(), "tone": "green", "hint": f"{today:%Y年%m月}"},
        ]
        context.update({
            "today": today,
            "week_start": week_start,
            "week_end": week_end,
            "today_tasks": today_tasks[:8],
            "week_tasks": week_tasks[:10],
            "overdue_tasks": overdue_tasks[:8],
            "today_meetings": today_meetings[:6],
            "week_meetings": week_meetings[:8],
            "today_followups": today_followups[:6],
            "week_followups": week_followups[:8],
            "active_projects": projects[:6],
            "open_notes": open_notes[:6],
            "must_do_note_count": open_notes.filter(status=IssueNote.Status.MUST_DO).count(),
            "open_note_count": open_notes.count(),
            "active_project_count": projects.count(),
            "week_meeting_count": today_meetings.count() + week_meetings.count(),
        })
        return context


class AccountAdminRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_staff or self.request.user.role == User.Role.ADMIN


class AccountManagementView(AccountAdminRequiredMixin, ListView):
    model = User
    template_name = "accounts/account_list.html"
    context_object_name = "accounts"

    def get_queryset(self):
        queryset = User.objects.select_related("department").order_by("department__code", "display_name", "username")
        query = self.request.GET.get("q", "").strip()
        if query:
            from django.db.models import Q
            queryset = queryset.filter(Q(display_name__icontains=query) | Q(username__icontains=query))
        return queryset


class AccountCredentialUpdateView(AccountAdminRequiredMixin, UpdateView):
    model = User
    form_class = AccountCredentialForm
    template_name = "accounts/account_form.html"
    success_url = reverse_lazy("account_management")
