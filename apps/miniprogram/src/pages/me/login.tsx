import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

const API_BASE_URL = process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3000';

export default function LoginPage() {
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    try {
      const result = await Taro.login();
      if (!result.code) throw new Error('微信未返回登录凭证');
      const response = await Taro.request<{ accessToken: string }>({
        url: `${API_BASE_URL}/v1/auth/wechat-login`,
        method: 'POST',
        data: { code: result.code },
      });
      Taro.setStorageSync('accessToken', response.data.accessToken);
      Taro.redirectTo({ url: '/pages/me/index' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
      Taro.showToast({ title: message.slice(0, 20), icon: 'none' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="page">
      <View className="card">
        <Text>开启你的考研备考计划</Text>
        <View className="muted" style={{ marginTop: '16rpx' }}>
          使用微信一键登录，保存个人学习目标与考试档案。
        </View>
        <Button type="primary" loading={busy} disabled={busy} onClick={login} style={{ marginTop: '32rpx' }}>
          微信一键登录
        </Button>
      </View>
    </View>
  );
}
