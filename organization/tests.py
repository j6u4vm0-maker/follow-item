from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from .models import Department


class DepartmentTests(TestCase):
    def test_code_must_be_unique(self):
        Department.objects.create(code="HQ", name="公司總部", unit_type=Department.UnitType.HEADQUARTERS)
        Department.objects.create(code="ENG", name="工程", unit_type=Department.UnitType.DEPARTMENT)
        with self.assertRaises(IntegrityError):
            Department.objects.create(code="ENG", name="另一工程部", unit_type=Department.UnitType.DEPARTMENT)

    def test_valid_five_level_hierarchy(self):
        headquarters = Department(code="HQ", name="公司總部", unit_type=Department.UnitType.HEADQUARTERS)
        headquarters.full_clean()
        headquarters.save()
        division = Department(code="D1", name="營運處", unit_type=Department.UnitType.DIVISION, parent=headquarters)
        division.full_clean()
        division.save()
        department = Department(code="QA", name="品質部", unit_type=Department.UnitType.DEPARTMENT, parent=division)
        department.full_clean()
        department.save()
        section = Department(code="QA1", name="品保課", unit_type=Department.UnitType.SECTION, parent=department)
        section.full_clean()
        section.save()
        group = Department(code="QA1A", name="稽核組", unit_type=Department.UnitType.GROUP, parent=section)
        group.full_clean()
        group.save()
        self.assertEqual(group.hierarchy_path, "公司總部 → 營運處 → 品質部 → 品保課 → 稽核組")

    def test_level_cannot_skip_parent(self):
        headquarters = Department.objects.create(code="HQ", name="公司總部", unit_type=Department.UnitType.HEADQUARTERS)
        department = Department(code="QA", name="品質部", unit_type=Department.UnitType.DEPARTMENT, parent=headquarters)
        with self.assertRaises(ValidationError):
            department.full_clean()
