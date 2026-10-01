from django.db import migrations


DEFAULT_TAGS = [
    ("緊急", "#DC2626"),
    ("主管交辦", "#F97316"),
    ("跨部門", "#7C3AED"),
    ("例行工作", "#2563EB"),
    ("專案", "#0891B2"),
    ("改善事項", "#16A34A"),
    ("待確認", "#CA8A04"),
    ("外部需求", "#DB2777"),
    ("稽核", "#475569"),
    ("會議決議", "#0D9488"),
]


def seed_default_tags(apps, schema_editor):
    Tag = apps.get_model("workitems", "Tag")
    for name, color in DEFAULT_TAGS:
        Tag.objects.get_or_create(name=name, defaults={"color": color, "is_active": True})


class Migration(migrations.Migration):
    dependencies = [("workitems", "0002_project_task_project")]
    operations = [migrations.RunPython(seed_default_tags, migrations.RunPython.noop)]
