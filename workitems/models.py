from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone


class TaskCategory(models.Model):
    name = models.CharField("類別名稱", max_length=100, unique=True)
    is_active = models.BooleanField("啟用", default=True)
    sort_order = models.PositiveIntegerField("排序", default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = "工作類別"
        verbose_name_plural = "工作類別"

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField("標籤名稱", max_length=60, unique=True)
    color = models.CharField("顏色", max_length=7, default="#2874C7")
    is_active = models.BooleanField("啟用", default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "標籤"
        verbose_name_plural = "標籤"

    def __str__(self):
        return self.name


class TaskNumberSequence(models.Model):
    year = models.PositiveSmallIntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)


class Project(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "進行中"
        ON_HOLD = "on_hold", "暫停"
        COMPLETED = "completed", "已完成"

    name = models.CharField("專案名稱", max_length=160, unique=True)
    description = models.TextField("專案說明", blank=True)
    owner_department = models.ForeignKey(
        "organization.Department", verbose_name="主責部門", on_delete=models.PROTECT, related_name="projects"
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="專案負責人", on_delete=models.PROTECT, related_name="managed_projects"
    )
    start_date = models.DateField("開始日期")
    due_date = models.DateField("預計完成日")
    status = models.CharField("專案狀態", max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="建立人", on_delete=models.PROTECT, related_name="created_projects"
    )
    created_at = models.DateTimeField("建立時間", auto_now_add=True)

    class Meta:
        ordering = ["status", "due_date", "name"]
        verbose_name = "專案"
        verbose_name_plural = "專案"

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValidationError({"due_date": "預計完成日不得早於開始日期。"})
        if self.manager_id and self.owner_department_id and self.manager.department_id != self.owner_department_id:
            raise ValidationError({"manager": "專案負責人必須屬於主責部門。"})

    @property
    def progress(self):
        values = list(self.tasks.values_list("progress", flat=True))
        return round(sum(values) / len(values)) if values else 0


class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "低"
        MEDIUM = "medium", "中"
        HIGH = "high", "高"
        URGENT = "urgent", "緊急"

    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "未開始"
        IN_PROGRESS = "in_progress", "進行中"
        WAITING = "waiting", "等待"
        COMPLETED = "completed", "完成"
        CANCELLED = "cancelled", "取消"

    task_no = models.CharField("工作編號", max_length=20, unique=True, editable=False)
    title = models.CharField("工作名稱", max_length=200)
    description = models.TextField("工作說明")
    project = models.ForeignKey(
        Project, verbose_name="所屬專案", on_delete=models.SET_NULL, related_name="tasks", null=True, blank=True
    )
    category = models.ForeignKey(TaskCategory, verbose_name="工作類別", on_delete=models.PROTECT)
    tags = models.ManyToManyField(Tag, through="TaskTag", verbose_name="標籤", blank=True)
    request_department = models.ForeignKey(
        "organization.Department", verbose_name="需求部門", on_delete=models.PROTECT, related_name="requested_tasks"
    )
    requestor = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="需求人", on_delete=models.PROTECT, related_name="requested_tasks"
    )
    request_date = models.DateField("提出日期", default=timezone.localdate)
    owner_department = models.ForeignKey(
        "organization.Department", verbose_name="負責部門", on_delete=models.PROTECT, related_name="owned_tasks"
    )
    primary_assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="主要負責人", on_delete=models.PROTECT, related_name="primary_tasks"
    )
    collaborators = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="TaskAssignee", related_name="collaborating_tasks", verbose_name="協作人員"
    )
    priority = models.CharField("優先度", max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField("狀態", max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    progress = models.PositiveSmallIntegerField("進度", default=0)
    planned_start_date = models.DateField("預計開始日", null=True, blank=True)
    due_date = models.DateField("預計完成日")
    completed_at = models.DateTimeField("實際完成時間", null=True, blank=True, editable=False)
    waiting_reason = models.TextField("等待原因", blank=True)
    cancellation_reason = models.TextField("取消原因", blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_tasks", verbose_name="建立人"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="updated_tasks", verbose_name="最後修改人"
    )
    created_at = models.DateTimeField("建立時間", auto_now_add=True)
    updated_at = models.DateTimeField("最後修改時間", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["owner_department", "status"]),
            models.Index(fields=["primary_assignee", "status"]),
        ]
        verbose_name = "工作單"
        verbose_name_plural = "工作單"

    def __str__(self):
        return f"{self.task_no} {self.title}"

    @classmethod
    def next_task_no(cls):
        year = timezone.localdate().year
        with transaction.atomic():
            sequence, _ = TaskNumberSequence.objects.select_for_update().get_or_create(year=year)
            sequence.last_number += 1
            sequence.save(update_fields=["last_number"])
            return f"TASK-{year}-{sequence.last_number:04d}"

    def clean(self):
        errors = {}
        if self.progress < 0 or self.progress > 100:
            errors["progress"] = "進度必須介於 0 到 100。"
        if self.planned_start_date and self.due_date and self.due_date < self.planned_start_date:
            errors["due_date"] = "預計完成日不得早於預計開始日。"
        if self.requestor_id and self.request_department_id and self.requestor.department_id != self.request_department_id:
            errors["requestor"] = "需求人必須屬於需求部門。"
        if self.primary_assignee_id and self.owner_department_id and self.primary_assignee.department_id != self.owner_department_id:
            errors["primary_assignee"] = "主要負責人必須屬於負責部門。"
        if self.status == self.Status.CANCELLED and not self.cancellation_reason.strip():
            errors["cancellation_reason"] = "取消工作時必須填寫取消原因。"
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.task_no:
            self.task_no = self.next_task_no()
        if self.status == self.Status.COMPLETED:
            self.progress = 100
            if not self.completed_at:
                self.completed_at = timezone.now()
        elif self.completed_at:
            self.completed_at = None
        self.full_clean(exclude=["tags", "collaborators"])
        return super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        return self.status not in {self.Status.COMPLETED, self.Status.CANCELLED} and self.due_date < timezone.localdate()


class TaskAssignee(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "user"], name="unique_task_collaborator")]
        verbose_name = "工作協作人員"
        verbose_name_plural = "工作協作人員"


class TaskTag(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "tag"], name="unique_task_tag")]


class IssueNote(models.Model):
    class Status(models.TextChoices):
        INBOX = "inbox", "收集箱"
        MUST_DO = "must_do", "今日必做"
        IN_PROGRESS = "in_progress", "進行中"
        DONE = "done", "已完成"

    title = models.CharField("問題主旨", max_length=160)
    content = models.TextField("問題內容", blank=True)
    reported_by_name = models.CharField("提出人", max_length=100, blank=True)
    status = models.CharField("狀態", max_length=20, choices=Status.choices, default=Status.INBOX)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="記錄人", on_delete=models.PROTECT, related_name="issue_notes"
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="處理人", on_delete=models.PROTECT,
        related_name="resolved_issue_notes", null=True, blank=True,
    )
    resolved_at = models.DateTimeField("處理時間", null=True, blank=True)
    created_at = models.DateTimeField("建立時間", auto_now_add=True)
    updated_at = models.DateTimeField("更新時間", auto_now=True)

    class Meta:
        ordering = ["status", "-created_at"]
        verbose_name = "問題便簽"
        verbose_name_plural = "問題便簽"

    def __str__(self):
        return self.title


class MeetingSeries(models.Model):
    class MeetingType(models.TextChoices):
        PROJECT = "project", "專案會議"
        WEEKLY = "weekly", "例行週會"
        DAILY = "daily", "每日會議"

    name = models.CharField("會議系列名稱", max_length=160)
    meeting_type = models.CharField("會議類型", max_length=20, choices=MeetingType.choices)
    project = models.ForeignKey(Project, verbose_name="關聯專案", on_delete=models.SET_NULL, null=True, blank=True, related_name="meeting_series")
    department = models.ForeignKey("organization.Department", verbose_name="關聯組織", on_delete=models.PROTECT, null=True, blank=True, related_name="meeting_series")
    chair = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="主席", on_delete=models.PROTECT, related_name="chaired_meeting_series")
    recorder = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="預設記錄人", on_delete=models.PROTECT, related_name="recorded_meeting_series")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, verbose_name="固定出席人員", related_name="meeting_series", blank=True)
    frequency = models.CharField("召開頻率", max_length=80, blank=True)
    default_agenda = models.TextField("預設議程", blank=True)
    location = models.CharField("會議地點", max_length=150, blank=True)
    carry_unfinished = models.BooleanField("未完成事項帶到下次會議", default=True)
    is_active = models.BooleanField("啟用", default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="建立人", on_delete=models.PROTECT, related_name="created_meeting_series")
    created_at = models.DateTimeField("建立時間", auto_now_add=True)

    class Meta:
        ordering = ["meeting_type", "name"]
        verbose_name = "會議系列"
        verbose_name_plural = "會議系列"

    def __str__(self):
        return self.name


class Meeting(models.Model):
    class Status(models.TextChoices):
        PREPARING = "preparing", "準備中"
        IN_PROGRESS = "in_progress", "進行中"
        COMPLETED = "completed", "已結束"

    series = models.ForeignKey(MeetingSeries, verbose_name="會議系列", on_delete=models.CASCADE, related_name="meetings")
    title = models.CharField("會議名稱", max_length=180)
    scheduled_at = models.DateTimeField("會議時間")
    status = models.CharField("狀態", max_length=20, choices=Status.choices, default=Status.PREPARING)
    chair = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="主席", on_delete=models.PROTECT, related_name="chaired_meetings")
    recorder = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="記錄人", on_delete=models.PROTECT, related_name="recorded_meetings")
    attendees = models.ManyToManyField(settings.AUTH_USER_MODEL, verbose_name="出席人員", related_name="meetings", blank=True)
    absentees = models.ManyToManyField(settings.AUTH_USER_MODEL, verbose_name="缺席人員", related_name="absent_meetings", blank=True)
    agenda = models.TextField("本次議程", blank=True)
    location = models.CharField("會議地點", max_length=150, blank=True)
    summary = models.TextField("會議摘要", blank=True)
    started_at = models.DateTimeField("開始時間", null=True, blank=True)
    ended_at = models.DateTimeField("結束時間", null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="建立人", on_delete=models.PROTECT, related_name="created_meetings")
    created_at = models.DateTimeField("建立時間", auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_at"]
        verbose_name = "會議"
        verbose_name_plural = "會議"

    def __str__(self):
        return self.title


class MeetingItem(models.Model):
    meeting = models.ForeignKey(Meeting, verbose_name="會議", on_delete=models.CASCADE, related_name="items")
    task = models.ForeignKey(Task, verbose_name="關聯工作", on_delete=models.SET_NULL, null=True, blank=True, related_name="meeting_items")
    topic = models.CharField("討論事項", max_length=220)
    progress_note = models.TextField("本次進度", blank=True)
    issue = models.TextField("問題與阻礙", blank=True)
    decision = models.TextField("會議決議", blank=True)
    next_action = models.TextField("下一步", blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name="行動負責人", on_delete=models.SET_NULL, null=True, blank=True, related_name="meeting_actions")
    due_date = models.DateField("追蹤期限", null=True, blank=True)
    carry_to_next = models.BooleanField("下次繼續追蹤", default=True)
    order = models.PositiveIntegerField("順序", default=0)
    updated_at = models.DateTimeField("更新時間", auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "會議事項"
        verbose_name_plural = "會議事項"

    def __str__(self):
        return self.topic


class IssueNoteAttachment(models.Model):
    note = models.ForeignKey(IssueNote, on_delete=models.CASCADE, related_name="attachments", verbose_name="問題便簽")
    file = models.FileField("附件", upload_to="issue_notes/%Y/%m/")
    original_name = models.CharField("原始檔名", max_length=255)
    file_size = models.PositiveBigIntegerField("檔案大小", default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="issue_note_attachments", verbose_name="上傳人"
    )
    created_at = models.DateTimeField("上傳時間", auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "便簽附件"
        verbose_name_plural = "便簽附件"

    def __str__(self):
        return self.original_name
