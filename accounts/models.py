from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "系統管理員"
        MANAGER = "manager", "主管"
        USER = "user", "一般使用者"
        VIEWER = "viewer", "唯讀使用者"

    department = models.ForeignKey(
        "organization.Department",
        verbose_name="所屬部門",
        on_delete=models.PROTECT,
        related_name="members",
        null=True,
        blank=True,
    )
    display_name = models.CharField("顯示名稱", max_length=100)
    role = models.CharField("角色", max_length=20, choices=Role.choices, default=Role.USER)
    preferred_task_departments = models.ManyToManyField(
        "organization.Department",
        verbose_name="偏好的工作檢視單位",
        related_name="preferred_by_users",
        blank=True,
    )

    class Meta:
        ordering = ["department__code", "username"]
        verbose_name = "使用者"
        verbose_name_plural = "使用者"

    def __str__(self):
        return self.display_name or self.username

    @property
    def is_department_manager(self):
        return self.role in {self.Role.ADMIN, self.Role.MANAGER}
