export interface IEventListener<T> {
  handle(event: T): void | Promise<void>;
}
