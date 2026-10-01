from django import forms
from django.utils import timezone
from accounts.models import User
from organization.models import Department
from .models import IssueNote, MeetingSeries, Project, Tag, Task, TaskCategory


class MeetingSeriesForm(forms.ModelForm):
    class Meta:
        model = MeetingSeries
        fields = ["name", "meeting_type", "project", "department", "chair", "recorder", "members", "frequency", "location", "default_agenda", "carry_unfinished"]
        labels = {
            "name": "會議系列預設名稱",
            "meeting_type": "會議類型",
            "project": "關聯專案",
            "department": "關聯組織",
            "chair": "預設主席",
            "recorder": "預設記錄人",
            "members": "預設出席人員",
            "frequency": "召開頻率",
            "location": "會議地點",
            "default_agenda": "預設議程",
            "carry_unfinished": "未完成事項帶到下次會議",
        }
        widgets = {
            "name": forms.TextInput(attrs={"placeholder": "例如：供應商管理改善專案會議"}),
            "members": forms.SelectMultiple(attrs={"size": 6}),
            "default_agenda": forms.Textarea(attrs={"rows": 4, "placeholder": "例如：上次追蹤、進度更新、問題與決議、下週行動"}),
            "frequency": forms.TextInput(attrs={"placeholder": "例如：每週三 14:00"}),
            "location": forms.TextInput(attrs={"placeholder": "例如：第 3 會議室 或 線上 Teams"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        active_users = User.objects.filter(is_active=True).order_by("department__code", "display_name")
        for field in ("chair", "recorder", "members"):
            self.fields[field].queryset = active_users
        self.fields["department"].queryset = Department.objects.filter(is_active=True).order_by("code")
        self.fields["project"].queryset = Project.objects.exclude(status=Project.Status.COMPLETED)

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("meeting_type") == MeetingSeries.MeetingType.PROJECT and not cleaned.get("project"):
            self.add_error("project", "專案會議請選擇關聯專案。")
        if cleaned.get("meeting_type") != MeetingSeries.MeetingType.PROJECT and not cleaned.get("department"):
            self.add_error("department", "例行或每日會議請選擇關聯組織。")
        return cleaned


class IssueNoteForm(forms.ModelForm):
    class Meta:
        model = IssueNote
        fields = ["reported_by_name", "title", "content"]
        widgets = {
            "reported_by_name": forms.TextInput(attrs={"placeholder": "誰提出的問題（選填）"}),
            "title": forms.TextInput(attrs={"placeholder": "一句話記下問題"}),
            "content": forms.Textarea(attrs={"rows": 3, "placeholder": "補充背景、現象或待確認事項…"}),
        }


class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ["name", "description", "owner_department", "manager", "start_date", "due_date", "status"]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 3}),
            "start_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "due_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        department_id = self.data.get("owner_department") or getattr(self.instance, "owner_department_id", None)
        self.fields["manager"].queryset = User.objects.filter(is_active=True, department_id=department_id) if department_id else User.objects.none()


class TaskForm(forms.ModelForm):
    collaborators = forms.ModelMultipleChoiceField(
        label="協作人員", queryset=User.objects.none(), required=False, widget=forms.SelectMultiple(attrs={"size": 6})
    )
    tags = forms.ModelMultipleChoiceField(
        label="標籤", queryset=Tag.objects.filter(is_active=True), required=False, widget=forms.SelectMultiple(attrs={"size": 5})
    )

    class Meta:
        model = Task
        fields = [
            "title", "description", "project", "category", "tags", "request_department", "requestor", "request_date",
            "owner_department", "primary_assignee", "collaborators", "priority", "status", "progress",
            "planned_start_date", "due_date", "waiting_reason", "cancellation_reason",
        ]
        widgets = {
            "title": forms.TextInput(attrs={"placeholder": "例如：新版供應商稽核表單製作"}),
            "description": forms.Textarea(attrs={"rows": 3, "placeholder": "請說明工作內容、預期成果與注意事項…"}),
            "status": forms.RadioSelect,
            "waiting_reason": forms.Textarea(attrs={"rows": 3}),
            "cancellation_reason": forms.Textarea(attrs={"rows": 3}),
            "request_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "planned_start_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "due_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.is_bound and not self.instance.pk:
            proposed_date = self.initial.get("request_date") or timezone.localdate()
            self.initial.setdefault("request_date", proposed_date)
            self.initial.setdefault("planned_start_date", proposed_date)
        self.fields["category"].queryset = TaskCategory.objects.filter(is_active=True)
        if not self.is_bound and not self.instance.pk:
            default_category = self.fields["category"].queryset.filter(name="一般工作").first()
            if default_category:
                self.fields["category"].initial = default_category
        self.fields["project"].queryset = Project.objects.exclude(status=Project.Status.COMPLETED)
        self.fields["request_department"].queryset = Department.objects.filter(is_active=True)
        self.fields["owner_department"].queryset = Department.objects.filter(is_active=True)
        request_department = self.data.get("request_department") or getattr(self.instance, "request_department_id", None)
        owner_department = self.data.get("owner_department") or getattr(self.instance, "owner_department_id", None)
        self.fields["requestor"].queryset = User.objects.filter(is_active=True, department_id=request_department) if request_department else User.objects.none()
        owner_users = User.objects.filter(is_active=True, department_id=owner_department) if owner_department else User.objects.none()
        self.fields["primary_assignee"].queryset = owner_users
        self.fields["collaborators"].queryset = User.objects.filter(is_active=True).order_by("department__code", "display_name")
        if self.instance.pk:
            self.fields["collaborators"].initial = self.instance.collaborators.all()
            self.fields["tags"].initial = self.instance.tags.all()

    def save(self, commit=True):
        task = super().save(commit=commit)
        if commit:
            task.collaborators.set(self.cleaned_data["collaborators"])
            task.tags.set(self.cleaned_data["tags"])
        return task
