from django.db import transaction

from accounts.models import User
from organization.models import Department


DEPARTMENTS = [
    ("QMDIV", "品質管理處", Department.UnitType.DIVISION, "Z00"),
    ("QSD", "品質系統部", Department.UnitType.DEPARTMENT, "QMDIV"),
    ("QST", "品質技術課", Department.UnitType.SECTION, "QSD"),
    ("QST-SM", "供應商管理組", Department.UnitType.GROUP, "QST"),
    ("QST-QT", "品質技術組", Department.UnitType.GROUP, "QST"),
    ("QSS", "品質系統課", Department.UnitType.SECTION, "QSD"),
    ("QSS-LAB", "實驗室", Department.UnitType.GROUP, "QSS"),
]

PEOPLE = [
    ("division_manager", "處級主管範例", "QST", User.Role.MANAGER),
    ("group_manager_a", "組長範例 A", "QST-SM", User.Role.MANAGER),
    ("member_a", "組員範例 A", "QST-SM", User.Role.USER),
    ("member_b", "組員範例 B", "QST-SM", User.Role.USER),
    ("section_manager", "課級主管範例", "QSS", User.Role.MANAGER),
    ("group_manager_b", "組長範例 B", "QSS-LAB", User.Role.MANAGER),
]


@transaction.atomic
def run():
    units = {item.code: item for item in Department.objects.all()}
    for code, name, unit_type, parent_code in DEPARTMENTS:
        parent = units[parent_code]
        unit, _ = Department.objects.update_or_create(
            code=code,
            defaults={"name": name, "unit_type": unit_type, "parent": parent, "is_active": True},
        )
        unit.full_clean()
        unit.save()
        units[code] = unit

    for username, display_name, department_code, role in PEOPLE:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"display_name": display_name, "department": units[department_code], "role": role},
        )
        user.display_name = display_name
        user.department = units[department_code]
        user.role = role
        user.is_active = True
        if created:
            user.set_unusable_password()
        user.save()

    return len(DEPARTMENTS), len(PEOPLE)
