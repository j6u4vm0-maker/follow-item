from django.db.models import Q

from accounts.models import User


def department_scope_ids(department):
    if not department:
        return []
    ids = [department.id]
    frontier = [department.id]
    from organization.models import Department
    while frontier:
        frontier = list(Department.objects.filter(parent_id__in=frontier).values_list("id", flat=True))
        ids.extend(frontier)
    return ids


def visible_tasks(user, queryset):
    if user.is_superuser or user.role == User.Role.ADMIN:
        return queryset
    related = Q(created_by=user) | Q(requestor=user) | Q(primary_assignee=user) | Q(taskassignee__user=user)
    if user.role == User.Role.MANAGER:
        scope = department_scope_ids(user.department)
        related |= Q(request_department_id__in=scope) | Q(owner_department_id__in=scope)
    return queryset.filter(related).distinct()


def can_edit_task(user, task):
    if user.is_superuser or user.role == User.Role.ADMIN:
        return True
    if user.role == User.Role.VIEWER:
        return False
    if user.role == User.Role.MANAGER:
        scope = department_scope_ids(user.department)
        return task.owner_department_id in scope or task.request_department_id in scope
    return task.created_by_id == user.id or task.primary_assignee_id == user.id or task.taskassignee_set.filter(user=user).exists()

