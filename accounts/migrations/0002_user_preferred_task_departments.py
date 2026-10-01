from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("organization", "0002_department_parent_department_unit_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="preferred_task_departments",
            field=models.ManyToManyField(
                blank=True,
                related_name="preferred_by_users",
                to="organization.department",
                verbose_name="偏好的工作檢視單位",
            ),
        ),
    ]
