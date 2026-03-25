/// <reference path="./as_type.d.ts" />

export class Calculator {
  value: i32 = 0 as i32;

  add(a: i32): void {
    this.value += a;
  }

  getValue(): i32 {
    return this.value;
  }
}
