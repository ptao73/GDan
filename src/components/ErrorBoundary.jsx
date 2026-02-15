import { Component } from 'react';

// 全局错误边界：捕获渲染异常，防止白屏
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#1b1b1b' }}>
          <h2>应用出现异常</h2>
          <p style={{ margin: '12px 0', color: '#5e5e5e' }}>
            请刷新页面重试。如果问题持续，请清除浏览器缓存。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#0d3b47',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '15px'
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
