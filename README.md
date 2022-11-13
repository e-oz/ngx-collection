Collection
==========
Collection State Management Service

# Purpose

This service will ease collection mutations, caused by create/read/update/delete (CRUD) actions - a common case for the collections in web applications.

Field `items` is supposed to replace a similar field in the state of your state management service.

Items will be correctly inserted, updated, and removed, data in items will not be mutated, and the state will be completely immutable.

Additionally, you can use fields isCreating, isUpdating, and others - service guarantees that these statuses will be updated correctly even in case of an error or empty stream termination.

Also, fields `updatingItems` and `deletingItems` can be used to asynchronously detect if some particular item is currently being updated or removed - using this, you can disable "Save" or "Delete" button for just the affected item, not for the whole list (if it's needed).

Optionally, you can use `hasItemIn()` method for a better check - items equality will be checked not only using `===`, but also using id fields (by comparator).    
This method can be used with any item and any list.

# Items comparison
The equality of items in `update` and `delete` operations will be checked using the comparator that you can replace, using `setComparator()` method.

The comparator will compare items using `===` first, then it will use id fields.

You can check the id fields list of the default comparator in [comparator.ts](comparator.ts) file.

# Usage
Use `inject()` function to inject this service.   
This service is not a global singleton and will be destroyed with the component.

### In your Component Store:

```ts
export class ExampleStore extends ComponentStore<ExampleState> {
  readonly examplesCollection = inject(CollectionService<Example>);
}
```

### In your component:

```ts
@Component({
  selector: 'example',
  ///...
  providers: [
    ExampleStore, 
    CollectionService
  ],
})
export class ExampleComponent {
  
  // Usage of `inject()` is required here (to make CollectionService instance accessible in the ExampleStore).
  // Declare it before usage of "store" field.
  protected readonly store = inject(ExampleStore);

  // here you can use "store" field already
  protected readonly examplesState$ = this.store.examplesCollection.state$;

}
```

## View Model

The most simple way to watch the state of the collection is to use `collection.vm$ | async` in your template.

Alternatively, you can use `collection.state$` or any other public field and method of the Collection Service class.

## Request parameters

### reuqest

In every parameters object, `reuqest` is an observable you are using to send the request to API:

```ts
  return this.exampleCollection.update({
    reuqest: this.exampleService.saveExample(data),
    item: exampleItem,
    onSuccess: () => this.messageService.success('Saved'),
    onError: () => this.messageService.error('Error'),
  });
```

### item

Parameter `item` is the item that you are mutating.  
You are receiving this item from the `items` field of the collection state.

```ts
  remove = this.effect<Example>(_ => _.pipe(
    exhaustMap((example) => {
      return this.examplesCollection.delete({
        reuqest: example.uuId ? this.exampleService.removeExample(example.uuId) : of(null),
        item: example,
        onSuccess: () => this.messageService.success('Removed'),
        onError: () => this.messageService.error('Error'),
      });
    })
  ));
```

If you can not provide this object, you can send any object containing the id field (with a matching id). See "Items comparison" for details.

```ts
  remove = this.effect<string>(_ => _.pipe(
    exhaustMap((uuId) => {
      return this.examplesCollection.delete({
        reuqest: uuId ? this.exampleService.removeExample(uuId) : of(null),
        item: {uuId: uuId},
        onSuccess: () => this.messageService.success('Removed'),
        onError: () => this.messageService.error('Error'),
      });
    })
  ));
```
