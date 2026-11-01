import { Component, type ReactNode } from 'react';
export default class ErrorBoundary extends Component<{children:ReactNode}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error:Error) { console.error('[app]',error); }
  render() {
    return this.state.failed ? <div className="mx-auto max-w-md p-8 text-center"><p>Не удалось открыть страницу. Попробуйте обновить магазин.</p><button className="mt-4 rounded-full bg-black px-6 py-3 text-white" onClick={()=>location.reload()}>Обновить</button></div> : this.props.children;
  }
}
