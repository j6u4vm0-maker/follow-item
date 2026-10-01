from django.core.exceptions import ValidationError
from django.db import models


class Department(models.Model):
    class UnitType(models.TextChoices):
        HEADQUARTERS = "headquarters", "總部"
        DIVISION = "division", "處"
        DEPARTMENT = "department", "部"
        SECTION = "section", "課"
        GROUP = "group", "組"

    UNIT_ORDER = {
        UnitType.HEADQUARTERS: 0,
        UnitType.DIVISION: 1,
        UnitType.DEPARTMENT: 2,
        UnitType.SECTION: 3,
        UnitType.GROUP: 4,
    }

    code = models.CharField("部門代碼", max_length=30, unique=True)
    name = models.CharField("部門名稱", max_length=100, unique=True)
    unit_type = models.CharField(
        "組織層級",
        max_length=20,
        choices=UnitType.choices,
        default=UnitType.DEPARTMENT,
    )
    parent = models.ForeignKey(
        "self",
        verbose_name="上級單位",
        on_delete=models.PROTECT,
        related_name="children",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField("啟用", default=True)
    created_at = models.DateTimeField("建立時間", auto_now_add=True)

    class Meta:
        ordering = ["unit_type", "code"]
        verbose_name = "部門"
        verbose_name_plural = "部門"

    def __str__(self):
        return f"{self.code} {self.name}（{self.get_unit_type_display()}）"

    def clean(self):
        super().clean()
        if self.unit_type == self.UnitType.HEADQUARTERS:
            if self.parent_id:
                raise ValidationError({"parent": "總部不可設定上級單位。"})
            return
        if not self.parent_id:
            raise ValidationError({"parent": "非總部單位必須指定上級單位。"})
        if self.pk and self.parent_id == self.pk:
            raise ValidationError({"parent": "單位不可將自己設為上級。"})
        expected_parent_level = self.UNIT_ORDER[self.unit_type] - 1
        if self.UNIT_ORDER[self.parent.unit_type] != expected_parent_level:
            parent_label = dict(self.UnitType.choices)[
                next(key for key, value in self.UNIT_ORDER.items() if value == expected_parent_level)
            ]
            raise ValidationError({"parent": f"{self.get_unit_type_display()}的上級必須是{parent_label}。"})
        ancestor = self.parent
        while ancestor:
            if self.pk and ancestor.pk == self.pk:
                raise ValidationError({"parent": "組織關係不可形成循環。"})
            ancestor = ancestor.parent

    @property
    def hierarchy_path(self):
        nodes = []
        current = self
        while current:
            nodes.append(current.name)
            current = current.parent
        return " → ".join(reversed(nodes))
