import { Component } from 'react';
import ErrorBoundaryContent from './ErrorBoundaryContent.jsx';

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
          <ErrorBoundaryContent />
        </div>
      );
    }
    return this.props.children;
  }
}
