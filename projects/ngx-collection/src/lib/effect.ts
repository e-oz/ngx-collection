import { isObservable, Observable, of, Subject, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

/**
 * This code is copied from NgRx ComponentStore (just a few lines edited to add `takeUntilDestroyed()`)
 * Credits: NgRx Team
 * https://ngrx.io/
 * Source: https://github.com/ngrx/platform/blob/main/modules/component-store/src/component-store.ts#L382
 * Docs:
 * https://ngrx.io/guide/component-store/effect#effect-method
 */
export function effect<
  ProvidedType = void,
  OriginType extends | Observable<ProvidedType> | unknown = Observable<ProvidedType>,
  ObservableType = OriginType extends Observable<infer A> ? A : never,
  ReturnType = ProvidedType | ObservableType extends void
    ? (
      observableOrValue?: ObservableType | Observable<ObservableType>
    ) => Subscription
    : (
      observableOrValue: ObservableType | Observable<ObservableType>
    ) => Subscription
>(generator: (origin$: OriginType) => Observable<unknown>): ReturnType {

  const destroyRef = inject(DestroyRef);
  const origin$ = new Subject<ObservableType>();
  generator(origin$ as OriginType)
  .pipe(takeUntilDestroyed(destroyRef))
  .subscribe();

  return ((
    observableOrValue?: ObservableType | Observable<ObservableType>
  ): Subscription => {
    const observable$ = isObservable(observableOrValue)
      ? observableOrValue
      : of(observableOrValue);
    return observable$.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => {
      origin$.next(value as ObservableType);
    });
  }) as unknown as ReturnType;
}
