import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organization", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="department",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="children",
                to="organization.department",
                verbose_name="上級單位",
            ),
        ),
        migrations.AddField(
            model_name="department",
            name="unit_type",
            field=models.CharField(
                choices=[
                    ("headquarters", "總部"),
                    ("division", "處"),
                    ("department", "部"),
                    ("section", "課"),
                    ("group", "組"),
                ],
                default="department",
                max_length=20,
                verbose_name="組織層級",
            ),
        ),
        migrations.AlterModelOptions(
            name="department",
            options={"ordering": ["unit_type", "code"], "verbose_name": "部門", "verbose_name_plural": "部門"},
        ),
    ]
