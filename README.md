# Conal

Conal은 Functional Reactive Programming 라이브러리입니다. Conal은 단독으로도 사용할 수 있고 React, SolidJS 등의 프론트엔드와 라이브러리와 함께 사용할 수도 있습니다.
Conal이란 이름은 [Push-pull FRP](https://scholar.google.com/citations?view_op=view_citation&hl=en&user=YMPAn9gAAAAJ&citation_for_view=YMPAn9gAAAAJ:Tyk-4Ss8FVUC)를 발명한 [Conal Elliott](http://conal.net/)에서 따왔습니다.

또한 Haskell의 [Reflex](https://reflex-frp.org/)에서 영감을 받았습니다.



## 🚀 특징

- **글리치 없음**

  [글리치](https://en.wikipedia.org/wiki/Reactive_programming#Glitches)는 이벤트의 전파가 다이아몬드 형태로 전파될때 발생할 수 있습니다. RxJS 등의 라이브러리는 이를 정상적으로 처리하지 못해 UI에서 깜빡임을 유발합니다.
- **동적 네트워크**

  Conal은 이벤트 전파 네트워크를 동적으로 변경하고 재구성할 수 있습니다. 상태는 자기만의 수명을 가지고 필요한 시간 동안만 존재합니다.


## 📦 설치

```bash
npm install @conaljs/conal
```

## 개념


### 이벤트

이벤트*Event*는 시간에 따라 발생하는 값들의 스트림입니다. 이벤트는 상태를 업데이트하거나 이펙트를 발생시킵니다.

이벤트 같은 프레임 두 번 이상 발생할 수 없습니다.

Conal에서 이벤트는 `Event` 타입을 가집니다.


### 상태

상태*Dynamic*은 시간에 따라 변화하는 값을 나타냅니다.

Conal에서 상태는 `Dynamic` 타입을 가집니다.




## 🔧 기본 요소

### `Timeline`

모든 반응형 값들은 특정한 `Timeline` 내에서 관리됩니다.

`Timeline`은 내부적으로 이벤트와 상태로 구성된 네트워크를 관리합니다.

```typescript
import { Timeline, proceedImmediately } from 'conal';

let proceed;
const t = new Timeline({
  onSourceEmission: proceedImmediately
});
```

### `source`

`source`는 외부에서 발생시킬 수 있는 이벤트입니다.

```typescript
// 이벤트 소스 생성
const [eClick, emitClick] = t.source<string>();

emitClick('hello');
```

### `state`

`state`는 `(초기값, 변경 이벤트)`로 정의되는 상태입니다.

```typescript
// 상태 생성
const dCounter = t.state(0, eClick.transform(() => dCounter.read() + 1));

// 현재 값 읽기
console.log(dCounter.read()); // 0

// 값 변화 감지
const [, dispose] = dCounter.on(value => console.log(value));
```

### `computed`

`computed`는 다른 상태로부터 파생되는 상태입니다.

`computed` 또한 `updated` 메소드를 통해 값의 변화를 감지할 수 있습니다.

```typescript
const dFullName = t.computed(() => 
  `${firstName.read()} ${lastName.read()}`;
);

dFullName.updated.on((fullName) => {
  console.log(fullName);
})
```

## 추가 연산자

### 변형된 이벤트

`transform` 메소드로 기존의 이벤트로부터 변형된 이벤트를 생성할 수 있습니다.

`Discard`를 throw함으로써 변형된 이벤트의 발생을 막습니다.

```typescript
const event = t.source<number>();

const doubledEvent = event.transform((x) => x * 2);
const filteredEvent = event.transform((x) => {
  if (x % 2 === 0) throw Discard
  return x;
});
```

### 병합된 이벤트

`merged` 메소드로 두 이벤트를 병합할 수 있습니다.

RxJS의 `merge`와 달리, 두 이벤트가 동시에 발생된 경우에 대해 명시적으로 처리할 수 있습니다.

```typescript
const e1 = t.source<number>();
const e2 = t.source<number>();

const eMerged = e1.merged(e2);
eMerged.on((x) => {
  if (x.type === "both") {
    // ...
  } else if (x.type === "left") {
    // ...
  } else if (x.type === "right") {
    // ...
  }
});
```

### 동적 이벤트 전환

`switching` 메소드는 `Dynamic<Event<T>>`를 `Event<T>`로 변환합니다.

```typescript
const currentEvent: Dynamic<Event<number>> = t.state(initialEvent, switchEvent);
const switchedEvent = t.switching(currentEvent);
```

### 동적 네트워크

`on` 메소드를 사용하여 이벤트에 따라 이펙트를 발생시키고 새로운 상태를 생성하고, 새로운 이벤트를 구독할 수 있습니다.

```typescript
const [eClick, emitClick] = t.source<unknown>();

// `eNewCounter` 이벤트가 발생했을때 네트워크를 재구성합니다.
const [eNewCounter, ] = eClick.on(() => {
	const [eClick, emitClick] = t.source<void>();
	const dCounter: Dynamic<number> = t.state<number>(
		0,
		eClick.transform<number>(() => dCounter.read() + 1),
	);
	return [dCounter, emitClick] as const;
});

const dCounters: Dynamic<[Dynamic<number>, () => void][]> = t.state<
	[Dynamic<number>, () => void][]
>(
	[],
	eNewCounter.transform<[Dynamic<number>, () => void][]>(
		(x) => [...dCounters.read(), x] as [Dynamic<number>, () => void][],
	),
);
```

## 🔗 예제

프로젝트의 `example/` 디렉토리에서 더 많은 실제 사용 예제를 확인할 수 있습니다:

## 📄 라이선스

MIT License
