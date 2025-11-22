import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Connect to admin namespace
    const socketInstance = io('http://localhost:3000/admin', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      toast.success('Real-time bağlantı kuruldu');
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setConnected(false);
      toast.error('Real-time bağlantı kesildi');
    });

    // Notifications
    socketInstance.on('notification', (data) => {
      console.log('🔔 Notification:', data);

      setNotifications((prev) => [data, ...prev].slice(0, 50));

      // Toast notification
      if (data.type === 'new_payment') {
        toast.success(data.message, {
          duration: 5000,
          icon: '💰',
        });
      } else if (data.type === 'payment_approved') {
        toast.success(data.message, {
          icon: '✅',
        });
      } else if (data.type === 'payment_rejected') {
        toast.error(data.message, {
          icon: '❌',
        });
      }
    });

    // Dashboard stats
    socketInstance.on('dashboard:stats', (data) => {
      console.log('📊 Dashboard stats:', data);
      setStats(data);
    });

    socketInstance.on('dashboard:update', (data) => {
      console.log('📊 Dashboard update:', data);
      setStats(data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const value = {
    socket,
    connected,
    notifications,
    stats,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
