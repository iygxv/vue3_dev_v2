import { isObject, extend, isIntegerKey, hasOwn, isArray, hasChanged } from '../../shared/src/index';
import { track, trigger } from './effect';
import { trackOpTypes, TriggerOrTypes } from './operators';
import { reactive, readonly } from './reactive';
// 实现new Proxy(targets, handler)

// 是不是仅读 ,仅读的属性set会报异常
// 是不是深度的
/**
 * 拦截获取
 * @param isReadonly 是否仅读
 * @param shallow 是否浅的
 */
function createGetter(isReadonly = false, shallow = false) {
  return function get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver)
    // 非仅读
    if (!isReadonly) {
      // 收集依赖
      track(target, trackOpTypes.GET, key)
    }
    if (shallow) {
      return res
    }
    if (isObject(res)) {
      // 递归(vue2的处理事一上来就递归, 而vue3只有当嵌套对象才去递归)
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}

function createSetter(shallow = false) {
  return function set(target, key, value, receiver) {
    let oldVal = target[key]
     // 我们需要区分是新增还是修改
     /**
      * 数组的情况, 例如: effect(() => state.arr[2])
      * 然后修改为 state.arr[2] = 2 (修改)  state.arr[10] = 10(新增)
      */
    const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target ,key)
    const res = Reflect.set(target, key, value, receiver) // 设置新的
    // 浅的, 直接返回就行
    if (shallow) {
      return res
    }
    // 如果还是对象, 递归
    if (isObject(res)) {
      return reactive(res)
    }
    if(!hadKey) {
      // 新增
      trigger(target, TriggerOrTypes.ADD, key, value)
    }else if(hasChanged(value, oldVal)) {
      // 修改
      trigger(target, TriggerOrTypes.SET, key, value, oldVal)
    }
    return res
  }

}


const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)


const set = createSetter()
const shallowSet = createSetter(true)

// 4种handler, 对应4个reactive
export const mutableHandlers = {
  get,
  set
}
export const shallowReactiveHandlers = {
  get: shallowGet,
  set: shallowSet
}

// 仅读的不会收集依赖
export const readonlyHandlers = {
  get: readonlyGet,
  set(target, key) {
    console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target)
    return true
  }
}
export const shallowReadonlyHandlers = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)