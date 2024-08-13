import { assertInInjectionContext, DestroyRef, inject, Injector, isDevMode, isSignal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, isObservable, type Observable, of, retry, type RetryConfig, Subject, type Subscription, take, tap, throwError } from 'rxjs';

export type CreateEffectOptions = {
  injector?: Injector,
  /**
   * @param retryOnError
   * This params allows your effect keep running on error.
   * When set to `false`, any non-caught error will terminate the effect.
   * Otherwise, generated effect will use `retry()`.
   * You can pass `RetryConfig` object here to configure `retry()` operator.
   */
  retryOnError?: boolean | RetryConfig,
};

export type EffectFnMethods = {
  nextValue: (fn: ((v: unknown) => void)) => void,
  nextError: (fn: ((v: unknown) => void)) => void,
  onNextValue(): Observable<unknown>,
  onNextError(): Observable<unknown>,
};

/**
 * This code is copied from NgRx ComponentStore and edited.
 * Credits: NgRx Team
 * https://ngrx.io/
 * Source: https://github.com/ngrx/platform/blob/main/modules/component-store/src/component-store.ts#L382
 * Docs:
 * https://ngrx.io/guide/component-store/effect#effect-method
 */
export function createEffect<
  ProvidedType = void,
  OriginType extends | Observable<ProvidedType> | unknown = Observable<ProvidedType>,
  ObservableType = OriginType extends Observable<infer A> ? A : never,
  ReturnType = ProvidedType | ObservableType extends void
    ? (
      observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>
    ) => Subscription
    : (
      observableOrValue: ObservableType | Observable<ObservableType> | Signal<ObservableType>
    ) => Subscription
>(generator: (origin$: OriginType) => Observable<unknown>, options?: CreateEffectOptions): ReturnType & EffectFnMethods {

  if (!options?.injector && isDevMode()) {
    assertInInjectionContext(createEffect);
  }

  const injector = options?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  const origin$ = new Subject<ObservableType>();
  const retryOnError = options?.retryOnError ?? true;
  const retryConfig = (typeof options?.retryOnError === 'object' && options?.retryOnError) ? options?.retryOnError : {} as RetryConfig;

  const nextValue = new Subject<unknown>()
  const nextError = new Subject<unknown>()

  const generated = generator(origin$ as OriginType).pipe(
    tap((v) => {
      if (nextValue.observed) {
        nextValue.next(v);
      }
    }),
    catchError((e) => {
      if (nextError.observed) {
        nextError.next(e);
      }
      return throwError(() => e);
    }));

  if (retryOnError) {
    generated.pipe(
      retry(retryConfig),
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  } else {
    generated.pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  }

  const effectFn = ((
    observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>
  ): Subscription => {
    const observable$ = isObservable(observableOrValue)
      ? observableOrValue
      : (isSignal(observableOrValue)
          ? toObservable(observableOrValue, { injector })
          : of(observableOrValue)
      );
    if (retryOnError) {
      return observable$.pipe(
        retry(retryConfig),
        takeUntilDestroyed(destroyRef)
      ).subscribe((value) => {
        origin$.next(value as ObservableType);
      });
    } else {
      return observable$.pipe(
        takeUntilDestroyed(destroyRef)
      ).subscribe((value) => {
        origin$.next(value as ObservableType);
      });
    }
  }) as unknown as ReturnType & EffectFnMethods;

  effectFn.nextValue = (fn: ((v: unknown) => void)) => {
    nextValue.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(fn);
  };
  effectFn.nextError = (fn: ((v: unknown) => void)) => {
    nextError.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(fn);
  };
  effectFn.onNextValue = () => nextValue.asObservable();
  effectFn.onNextError = () => nextError.asObservable();
  return effectFn;
}
