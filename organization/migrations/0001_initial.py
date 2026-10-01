from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=30, unique=True, verbose_name="部門代碼")),
                ("name", models.CharField(max_length=100, unique=True, verbose_name="部門名稱")),
                ("is_active", models.BooleanField(default=True, verbose_name="啟用")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="建立時間")),
            ],
            options={"verbose_name": "部門", "verbose_name_plural": "部門", "ordering": ["code"]},
        )
    ]

