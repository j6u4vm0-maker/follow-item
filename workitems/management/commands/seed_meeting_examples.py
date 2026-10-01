from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from organization.models import Department
from workitems.models import Meeting, MeetingItem, MeetingSeries, Project, Task


class Command(BaseCommand):
    help = "建立五組會議中心展示案例（可重複執行）"

    def handle(self, *args, **options):
        admin = User.objects.filter(is_active=True, is_superuser=True).first() or User.objects.filter(is_active=True, role__in=[User.Role.ADMIN, User.Role.MANAGER]).first() or User.objects.filter(is_active=True).first()
        if not admin:
            self.stderr.write("找不到可用的使用者，請先建立帳號。")
            return
        users = list(User.objects.filter(is_active=True).order_by("id")[:8])
        departments = list(Department.objects.filter(is_active=True).order_by("unit_type", "code"))
        projects = list(Project.objects.order_by("status", "id"))
        tasks = list(Task.objects.exclude(status=Task.Status.CANCELLED).select_related("primary_assignee").order_by("id"))

        def dep(preferred, fallback=0):
            return next((d for d in departments if preferred in d.name), departments[min(fallback, len(departments) - 1)] if departments else None)

        samples = [
            {"name": "供應商管理改善專案會議", "kind": MeetingSeries.MeetingType.PROJECT, "project": projects[0] if projects else None, "department": None, "frequency": "每週三 14:00", "agenda": "專案里程碑\n本週完成進度\n風險與跨部門協調\n下週行動", "state": Meeting.Status.COMPLETED, "days": -7},
            {"name": "品質系統課每週例會", "kind": MeetingSeries.MeetingType.WEEKLY, "project": None, "department": dep("品質系統"), "frequency": "每週一 09:00", "agenda": "專案會議待辦承接\n工作進度與逾期項目\n本週優先事項\n資源協調", "state": Meeting.Status.IN_PROGRESS, "days": 0},
            {"name": "品質技術組每日晨會", "kind": MeetingSeries.MeetingType.DAILY, "project": None, "department": dep("品質技術"), "frequency": "每日 08:30（15 分鐘）", "agenda": "昨日完成\n今日計畫\n需要協助的阻礙", "state": Meeting.Status.PREPARING, "days": 1},
            {"name": "跨部門品質改善會議", "kind": MeetingSeries.MeetingType.PROJECT, "project": projects[1] if len(projects) > 1 else (projects[0] if projects else None), "department": None, "frequency": "每雙週四 15:00", "agenda": "客訴與異常趨勢\n改善措施進度\n責任與期限確認", "state": Meeting.Status.COMPLETED, "days": -3},
            {"name": "管理審查準備會議", "kind": MeetingSeries.MeetingType.WEEKLY, "project": None, "department": dep("品質", 0), "frequency": "每週五 16:00", "agenda": "指標資料完整性\n管理審查簡報\n未結案件與主管決策", "state": Meeting.Status.PREPARING, "days": 2},
        ]
        if not departments and not projects:
            self.stderr.write("找不到組織或專案，無法建立會議案例。")
            return

        created_count = 0
        for index, spec in enumerate(samples):
            # 無專案資料時，將專案案例安全改為例行會議。
            kind = spec["kind"]
            project = spec["project"]
            department = spec["department"] or (departments[0] if departments else None)
            if kind == MeetingSeries.MeetingType.PROJECT and not project:
                kind = MeetingSeries.MeetingType.WEEKLY
            series, created = MeetingSeries.objects.update_or_create(
                name=spec["name"], defaults={
                    "meeting_type": kind, "project": project if kind == MeetingSeries.MeetingType.PROJECT else None,
                    "department": None if kind == MeetingSeries.MeetingType.PROJECT else department,
                    "chair": admin, "recorder": users[1] if len(users) > 1 else admin,
                    "frequency": spec["frequency"], "default_agenda": spec["agenda"],
                    "carry_unfinished": True, "is_active": True, "created_by": admin,
                },
            )
            series.members.set(users[:4])
            when = timezone.now() + timedelta(days=spec["days"])
            meeting, _ = Meeting.objects.update_or_create(
                series=series, title=f"{series.name}｜案例 {index + 1}",
                defaults={"scheduled_at": when, "status": spec["state"], "chair": admin,
                          "recorder": users[1] if len(users) > 1 else admin,
                          "summary": "已確認本週進度與後續責任分工。" if spec["state"] == Meeting.Status.COMPLETED else "",
                          "started_at": when if spec["state"] != Meeting.Status.PREPARING else None,
                          "ended_at": when + timedelta(hours=1) if spec["state"] == Meeting.Status.COMPLETED else None,
                          "created_by": admin},
            )
            meeting.attendees.set(users[:4])
            meeting.items.all().delete()
            chosen = tasks[index:index + 2] or tasks[:2]
            for item_index, task in enumerate(chosen):
                MeetingItem.objects.create(
                    meeting=meeting, task=task, topic=task.title,
                    progress_note=f"目前進度 {task.progress}%，會中確認執行狀況。",
                    issue="等待跨單位資料確認。" if item_index == 0 else "",
                    decision="由負責人於期限前回報成果。" if spec["state"] == Meeting.Status.COMPLETED else "",
                    next_action="整理資料並更新工作進度。", owner=task.primary_assignee,
                    due_date=task.due_date, carry_to_next=True, order=item_index,
                )
            if index == 1:
                MeetingItem.objects.create(meeting=meeting, topic="專案會議帶入｜供應商改善方案追蹤", progress_note="承接上次專案會議決議。", next_action="於本週例會確認改善證據。", owner=admin, due_date=timezone.localdate() + timedelta(days=5), order=9)
            created_count += int(created)

        self.stdout.write(self.style.SUCCESS(f"五組會議案例已就緒（新建 {created_count} 組，可重複執行不會重複）。"))
