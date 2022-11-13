import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'uniqueStatus',
  standalone: true,
  pure: true,
})
export class UniqueStatusPipe implements PipeTransform {
  transform<UniqueStatus, T>(statusMap: Map<UniqueStatus, T>, status: UniqueStatus): T | undefined {
    return statusMap.get(status);
  }
}

@Pipe({
  name: 'itemStatus',
  standalone: true,
  pure: true,
})
export class StatusesPipe implements PipeTransform {
  transform<T, Statuses>(statuses: Map<T, Statuses>, item: T): Statuses | undefined {
    return statuses.get(item);
  }
}
