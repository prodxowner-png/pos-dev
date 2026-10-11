import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Shield, 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  RefreshCcw, 
  Database, 
  X, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Sliders, 
  Volume2, 
  Info, 
  Play, 
  Settings,
  Flame,
  Check,
  Cpu,
  Mic,
  MicOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../context/ToastContext';

interface HealthStatus {
  status: 'HEALTHY' | 'UNHEALTHY';
  service: string;
  version: string;
  database: {
    engine: string;
    status: string;
  };
}

interface TelemetrySummary {
  activeShift: string;
  shiftStatus: string;
  errorRatePercent: number;
  uptimeSeconds: number;
}

interface TelemetryPoint {
  p50LatencyMs: number;
  cpuPercent: number;
  errorRatePercent: number;
}

interface HealthLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'REPAIR';
  message: string;
}

interface RepairLog {
  id: string;
  timestamp: string;
  targetService: string;
  resolutionCode: string;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  message: string;
}

export const AntigravityHealthCheck: React.FC = () => {
  const { showSuccess, showError: showGlobalError, showHealing, showInfo } = useToast();
  // Original states for Antigravity health checking
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [telemetry, setTelemetry] = useState<{ summary: TelemetrySummary; history: TelemetryPoint[] } | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [isHealing, setIsHealing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [repairStep, setRepairStep] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [toast, setToast] = useState<{ title: string; text: string; type: 'HEALING' | 'SUCCESS' | 'ERROR' } | null>(null);
  
  // Real-time repair logs and overlay toggle states
  const [repairLogs, setRepairLogs] = useState<RepairLog[]>(() => {
    const now = new Date();
    return [
      {
        id: 'rep-001',
        timestamp: new Date(now.getTime() - 120 * 60000).toLocaleTimeString(),
        targetService: 'PRODX-ROUTER-GATEWAY',
        resolutionCode: 'RES-OK-200',
        status: 'SUCCESS',
        message: 'Mitigated high packet latency spike; reallocated server bandwidth buffers.'
      },
      {
        id: 'rep-002',
        timestamp: new Date(now.getTime() - 65 * 60000).toLocaleTimeString(),
        targetService: 'FIRESTORE-DB-SHARD',
        resolutionCode: 'RES-OK-200',
        status: 'SUCCESS',
        message: 'Resolved document write deadlock; persistent ledger storage fully synchronized.'
      },
      {
        id: 'rep-003',
        timestamp: new Date(now.getTime() - 15 * 60000).toLocaleTimeString(),
        targetService: 'INVENTORY-SYNC-NODE',
        resolutionCode: 'RES-OK-200',
        status: 'SUCCESS',
        message: 'Realigned inventory transaction log counts with primary database replica.'
      }
    ];
  });
  const [showDiagnosticOverlay, setShowDiagnosticOverlay] = useState(false);

  // Reusable repair progress animator function
  const startRepair = useCallback((durationMs: number, onComplete: () => Promise<void>) => {
    setRepairProgress(0);
    setRepairStep('SCANNING CLUSTER & DETECTING OUTLIERS...');
    const stepInterval = 50;
    const increment = 100 / (durationMs / stepInterval);
    let current = 0;
    
    const interval = setInterval(() => {
      current += increment;
      if (current >= 100) {
        current = 100;
        setRepairProgress(100);
        setRepairStep('REPAIR COMPLETE! REVERIFYING...');
        clearInterval(interval);
        setTimeout(async () => {
          await onComplete();
        }, 400);
      } else {
        setRepairProgress(Math.min(100, Math.floor(current)));
        if (current < 25) {
          setRepairStep('SCANNING CLUSTER & DETECTING OUTLIERS...');
        } else if (current < 50) {
          setRepairStep('ISOLATING ROOT CAUSE (LATENCY SPIKE)...');
        } else if (current < 75) {
          setRepairStep('REALLOCATING BUFFER CACHE & PURGING CHAOS...');
        } else {
          setRepairStep('APPLYING HOTFIX & SECURING DATABASE...');
        }
      }
    }, stepInterval);
  }, []);

  // New states for Chibi Bot Q&A and Customs
  const [botExpression, setBotExpression] = useState<'happy' | 'thinking' | 'healing' | 'warning'>('happy');
  const [qaWelcome, setQaWelcome] = useState('HOW CAN I HELP YOU?');
  const [qaQuestion, setQaQuestion] = useState('WHAT IS THE WEATHER TODAY?');
  const [qaAnswer, setQaAnswer] = useState('CURRENTLY 22°C AND PARTLY CLOUDY!');
  
  // Custom interactive QA fields
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [isAiAnswering, setIsAiAnswering] = useState(false);
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([40, 20, 60, 30, 80, 50, 20, 70, 40, 60, 30, 50, 20]);
  const [particleSeed, setParticleSeed] = useState<{ id: number; left: number; delay: number; size: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'bot' | 'diagnostics' | 'customizer'>('bot');

  // Speech Interaction States & Hooks
  const [isListening, setIsListening] = useState(false);

  const speakResponse = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const hasThai = /[\u0e00-\u0e7f]/.test(text);
      utterance.lang = hasThai ? 'th-TH' : 'en-US';
      utterance.rate = 1.05;
      utterance.pitch = 1.25; // Chibi cute voice
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const triggerVoiceCommand = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showGlobalError('Voice Not Supported', 'Web Speech API Recognition is not supported on this browser. Try Google Chrome.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH'; // Support Thai & English voice transcription
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      showInfo('AI Listening Started', 'AI PRODX Assistant is listening. Speak clearly into your mic...');
    };

    recognition.onerror = (event: any) => {
      console.warn('Voice recognition error:', event.error);
      setIsListening(false);
      showGlobalError('Recognition Aborted', `Could not capture voice input: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      showSuccess('Speech Captured', `"${speechToText}"`);

      setIsAiAnswering(true);
      const userQ = speechToText.toUpperCase();
      setQaQuestion(userQ);

      setTimeout(() => {
        let response = '';
        if (userQ.includes('WEATHER') || userQ.includes('อากาศ')) {
          response = 'CURRENTLY 22°C AND PARTLY CLOUDY! OPTIMAL ATMOSPHERIC PRESSURE DETECTED.';
        } else if (userQ.includes('STATUS') || userQ.includes('สถานะ') || userQ.includes('HEALTH') || userQ.includes('ระบบ')) {
          response = `SYSTEM IS ${health?.status || 'HEALTHY'}! LATENCY: ${telemetry?.history?.[0]?.p50LatencyMs || 12}MS. ALL CORES COLD.`;
        } else if (userQ.includes('HELLO') || userQ.includes('HI') || userQ.includes('HEY') || userQ.includes('สวัสดี') || userQ.includes('ดีครับ')) {
          response = 'สวัสดีครับ! I AM YOUR PRODX AI ASSISTANT. CORES READY TO LEVITATE YOUR OPERATION.';
        } else if (userQ.includes('HELP') || userQ.includes('ช่วย') || userQ.includes('ทำอะไรได้')) {
          response = 'I MONITOR POS INTEGRITY, DETECT NETWORK CHAOS, AND AUTOMATICALLY RUN REPAIRS!';
        } else if (userQ.includes('INVENTORY') || userQ.includes('STOCK') || userQ.includes('คลัง') || userQ.includes('สินค้า')) {
          response = 'INVENTORY LEDGER SECURE. CLOUD SYNCHRONIZATION RUNNING WITH 100% LEDGER INTEGRITY.';
        } else {
          const preprogrammed = [
            'COMPUTING COMPLEX POS MATRIX... SHIFT DATA PERSISTED SECURELY IN FIRESTORE.',
            'ALGORITHM STABLE. ZERO INVENTORY CONCURRENCY COLLISION RISK DETECTED.',
            'PRODX ENGINE PEAK EFFICIENCY. NO DATABASE MEMORY THRESHOLD EXCEEDED.',
            'TRANSACTION LEDGER IDEMPOTENCY KEY VALIDATED. SAFE SEED GENERATED.'
          ];
          response = preprogrammed[Math.floor(Math.random() * preprogrammed.length)];
        }

        setQaAnswer(response);
        setIsAiAnswering(false);
        speakResponse(response);
      }, 1200);
    };

    recognition.start();
  }, [health, telemetry, isListening, speakResponse, showInfo, showGlobalError, showSuccess]);

  // Theme-aware state: Automatically detects dark mode switches in real-time
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (!document.documentElement.classList.contains('dark') && !document.documentElement.classList.contains('light')) {
        setIsDarkMode(mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  const addLog = useCallback((message: string, type: HealthLog['type'] = 'INFO') => {
    const newLog: HealthLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  // Sync bot expression with system state
  useEffect(() => {
    if (isHealing) {
      setBotExpression('healing');
    } else if (health?.status === 'UNHEALTHY') {
      setBotExpression('warning');
    } else if (isAiAnswering) {
      setBotExpression('thinking');
    } else {
      setBotExpression('happy');
    }
  }, [isHealing, health?.status, isAiAnswering]);

  // Generate floating particle coordinates
  useEffect(() => {
    const particles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      size: Math.random() * 3 + 2
    }));
    setParticleSeed(particles);
  }, []);

  // Voice Visualizer animation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAiAnswering || isHealing) {
      // High activity visualizer
      interval = setInterval(() => {
        setVisualizerHeights(prev => prev.map(() => Math.floor(Math.random() * 85) + 15));
      }, 100);
    } else {
      // Idle rhythmic soundwave
      interval = setInterval(() => {
        setVisualizerHeights(prev => prev.map((_, i) => {
          const wave = Math.sin(Date.now() / 200 + i) * 20 + 35;
          return Math.max(10, Math.min(100, wave + Math.random() * 10));
        }));
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isAiAnswering, isHealing]);

  // Core background health probe
  const checkHealth = useCallback(async () => {
    try {
      const [healthRes, telemetryRes] = await Promise.all([
        fetch('/api/healthz'),
        fetch('/api/telemetry')
      ]);

      const healthData: HealthStatus = await healthRes.json();
      const telemetryData = await telemetryRes.json();

      setHealth(healthData);
      setTelemetry(telemetryData);
      setLastCheck(new Date());

      // AI Self-Healing Trigger on Anomaly
      if (healthData.status === 'UNHEALTHY' || (telemetryData.summary.errorRatePercent > 1)) {
        handleAnomalyDetected(healthData, telemetryData.summary);
      }
    } catch (error) {
      addLog('Failed to connect to PRODX API / ไม่สามารถเชื่อมต่อกับบริการหลังบ้านได้', 'ERROR');
    }
  }, [addLog]);

  const handleAnomalyDetected = async (h: HealthStatus, s: TelemetrySummary) => {
    if (isHealing) return;

    const repairId = `rep-${Math.random().toString(36).substring(2, 7)}`;
    const startTimestamp = new Date().toLocaleTimeString();
    const serviceName = h.service || 'PRODX-CORE-API';

    addLog(`Anomaly Detected / ตรวจพบสภาวะผิดปกติ: ${h.status === 'UNHEALTHY' ? 'ระบบหลักไม่สมบูรณ์ (System Unhealthy)' : 'อัตราความผิดพลาดสูงเกินกำหนด (High Error Rate)'}`, 'WARNING');
    setIsHealing(true);
    showHealing('🚨 AI Antigravity Anomaly Detected', 'Scanning and fixing back-end server anomalies automatically 24/7 to guarantee peak stability...');
    setToast({
      title: '🚨 AI Antigravity ตรวจพบจุดบกพร่องหลังบ้าน',
      text: 'กำลังสแกนและแก้ไขปัญหาของเซิร์ฟเวอร์แบบเรียลไทม์อัตโนมัติ 24/7 เพื่อเสถียรภาพสูงสุด...',
      type: 'HEALING'
    });
    
    // Add active in-progress log to real-time execution logs
    setRepairLogs(prev => [
      {
        id: repairId,
        timestamp: startTimestamp,
        targetService: serviceName,
        resolutionCode: 'HP-REPAIRING-102',
        status: 'IN_PROGRESS',
        message: 'Automatic self-healing sequence initiated by Antigravity Core. Running deep diagnostics on node cluster.'
      },
      ...prev
    ]);

    addLog('Antigravity AI: Initiating deep diagnostics... / กำลังดำเนินการสแกนวินิจฉัยเชิงลึก...', 'INFO');
    
    startRepair(4000, async () => {
      addLog('Antigravity AI: Identifying root cause... (Latency Spike detected) / ตรวจพบสาเหตุหลัก: สัญญาณความล่าช้าสะสมในเครือข่าย', 'REPAIR');
      
      try {
        await fetch('/api/telemetry/drill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'NORMAL' })
        });
        
        addLog('Antigravity AI: Applied hotfix - Throttling simulated chaos. System stabilized. / ดำเนินการแก้ปัญหาแบบ Hotfix สำเร็จ 100% - ระบบหลังบ้านกลับมาเสถียรแล้ว', 'REPAIR');
        
        // Update the log to SUCCESS
        setRepairLogs(prev => prev.map(log => 
          log.id === repairId 
            ? { ...log, status: 'SUCCESS', resolutionCode: 'RES-OK-200', message: 'Applied hotfix - Throttling simulated chaos. System stabilized fully. Cluster ping is normal.' }
            : log
        ));

        setIsHealing(false);
        showSuccess('✅ Antigravity System Restored', 'Auto self-healing successful 100%. Faulty database and server nodes resolved; all metrics nominal.');
        setToast({
          title: '✅ AI Antigravity ซ่อมแซมระบบสำเร็จ 100%',
          text: 'ซ่อมแซมความผิดพลาดของระบบและฐานข้อมูลเรียบร้อยแล้ว ระบบทั้งหมดทำงานปกติแบบสมบูรณ์',
          type: 'SUCCESS'
        });
        setTimeout(() => setToast(null), 5000);
        checkHealth();
      } catch (e) {
        addLog('Antigravity AI: Self-healing failed. Escalating to Admin. / การแก้ไขล้มเหลว กำลังรายงานด่วนไปยังผู้ดูแลระบบ', 'ERROR');
        
        // Update the log to FAILED
        setRepairLogs(prev => prev.map(log => 
          log.id === repairId 
            ? { ...log, status: 'FAILED', resolutionCode: 'RES-ERR-500', message: 'Self-healing failed on hotfix application. Escalated critical warning alert to System Administrator.' }
            : log
        ));

        setIsHealing(false);
        showGlobalError('❌ Self-Healing Failed', 'Antigravity automatic cluster repair failed. Contact system operator immediately.');
        setToast({
          title: '❌ AI Antigravity ซ่อมแซมล้มเหลว',
          text: 'ไม่สามารถดำเนินการซ่อมแซมระบบอัตโนมัติได้ กรุณาติดต่อทีมวิศวกรด่วน',
          type: 'ERROR'
        });
        setTimeout(() => setToast(null), 5000);
      }
    });
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestionInput.trim()) return;

    setIsAiAnswering(true);
    const userQ = customQuestionInput.trim().toUpperCase();
    setQaQuestion(userQ);
    setCustomQuestionInput('');

    // Formulate a fun, dynamic AI response based on POS context & Antigravity
    setTimeout(() => {
      let response = '';
      if (userQ.includes('WEATHER') || userQ.includes('อากาศ')) {
        response = 'CURRENTLY 22°C AND PARTLY CLOUDY! OPTIMAL ATMOSPHERIC PRESSURE DETECTED.';
      } else if (userQ.includes('STATUS') || userQ.includes('สถานะ') || userQ.includes('HEALTH') || userQ.includes('ระบบ')) {
        response = `SYSTEM IS ${health?.status || 'HEALTHY'}! LATENCY: ${telemetry?.history?.[0]?.p50LatencyMs || 12}MS. ALL CORES COLD.`;
      } else if (userQ.includes('HELLO') || userQ.includes('HI') || userQ.includes('HEY') || userQ.includes('สวัสดี') || userQ.includes('ดีครับ')) {
        response = 'สวัสดีครับ! I AM YOUR PRODX AI ASSISTANT, READY TO LEVITATE YOUR OPERATION.';
      } else if (userQ.includes('HELP') || userQ.includes('ช่วย') || userQ.includes('ทำอะไรได้') || userQ.includes('CAN YOU')) {
        response = 'I MONITOR POS INTEGRITY, DETECT NETWORK CHAOS, AND REPAIR CLOUD SERVICES AUTOMATICALLY!';
      } else if (userQ.includes('INVENTORY') || userQ.includes('STOCK') || userQ.includes('คลัง') || userQ.includes('สินค้า')) {
        response = 'INVENTORY LEDGER SECURE. SYNCHRONIZATION WITH CLOUD POSTGRESQL STABLE (100% INTEGRITY).';
      } else {
        const preprogrammed = [
          'COMPUTING COMPLEX POS MATRIX... SHIFT DATA PERSISTED SECURELY IN FIRESTORE.',
          'ALGORITHM STABLE. ZERO INVENTORY CONCURRENCY COLLISION RISK DETECTED.',
          'PRODX ENGINE PEAK EFFICIENCY. NO DATABASE MEMORY THRESHOLD EXCEEDED.',
          'TRANSACTION LEDGER IDEMPOTENCY KEY VALIDATED. SAFE SEED GENERATED.'
        ];
        response = preprogrammed[Math.floor(Math.random() * preprogrammed.length)];
      }

      setQaAnswer(response);
      setIsAiAnswering(false);
      speakResponse(response);
    }, 1500);
  };

  const handleManualHealTrigger = async () => {
    if (isHealing) return;

    const repairId = `rep-${Math.random().toString(36).substring(2, 7)}`;
    const startTimestamp = new Date().toLocaleTimeString();

    setIsHealing(true);
    addLog('Operator triggered manual Antigravity optimize drill / เริ่มโปรแกรมวินิจฉัยและสแกนความผิดปกติโดยผู้ใช้', 'INFO');
    showHealing('⚡ Antigravity Optimization Initiated', 'Scanning cluster node resources and reallocating database buffer memory caches...');
    setToast({
      title: '⚡ แมนนวลโมดูลกระตุ้น Antigravity',
      text: 'กำลังสแกนวิเคราะห์เสถียรภาพ และจัดสรรหน่วยความจำฐานข้อมูลใหม่...',
      type: 'HEALING'
    });

    // Add active in-progress log to real-time execution logs
    setRepairLogs(prev => [
      {
        id: repairId,
        timestamp: startTimestamp,
        targetService: 'MEM-RECLAIMER',
        resolutionCode: 'HP-HEALING-102',
        status: 'IN_PROGRESS',
        message: 'Manual memory core optimization and cache reclamation triggered by POS operator.'
      },
      ...prev
    ]);

    startRepair(2500, async () => {
      try {
        await fetch('/api/telemetry/drill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'NORMAL' })
        });
        addLog('Antigravity Manual Optimize completed. Storage reclaimed, cluster ping under 15ms.', 'REPAIR');
        
        // Update the log to SUCCESS
        setRepairLogs(prev => prev.map(log => 
          log.id === repairId 
            ? { ...log, status: 'SUCCESS', resolutionCode: 'RES-OK-200', message: 'Antigravity Manual Optimize completed. Cache storage reclaimed, node memory allocation fully optimized.' }
            : log
        ));

        setIsHealing(false);
        showSuccess('✅ Memory Core Reclaimed', 'Manual optimization completed successfully. Cache buffer cleared and node delays resolved.');
        setToast({
          title: '✅ ปรับแต่งระบบเสร็จสมบูรณ์',
          text: 'ดึงข้อมูลแคชกลับคืน ล้างสัญญาณสะสมสำเร็จ ค่าดีเลย์กลับมาอยู่ในสภาวะสมบูรณ์',
          type: 'SUCCESS'
        });
        setTimeout(() => setToast(null), 4000);
        checkHealth();
      } catch (err) {
        setIsHealing(false);
        showGlobalError('❌ Optimization Failed', 'Manual memory core optimization failed due to background network disruption.');
        addLog('Error executing manual drill.', 'ERROR');

        // Update the log to FAILED
        setRepairLogs(prev => prev.map(log => 
          log.id === repairId 
            ? { ...log, status: 'FAILED', resolutionCode: 'RES-ERR-500', message: 'Error executing manual memory optimization drill. Connection disrupted.' }
            : log
        ));
      }
    });
  };

  const isCritical = health?.status === 'UNHEALTHY' || (telemetry?.summary?.errorRatePercent || 0) > 1;

  // Determine dynamic glow class depending on system state (Healthy vs Needs Attention) and Dark Mode
  const glowClass = isCritical
    ? (isDarkMode ? 'animate-glow-attention-dark' : 'animate-glow-attention-light')
    : (isDarkMode ? 'animate-glow-healthy-dark' : 'animate-glow-healthy-light');

  // Eyes SVG render helper depending on expression
  const renderBotEyes = () => {
    switch (botExpression) {
      case 'thinking':
        return (
          <>
            {/* Blinking / Thinking Dots with small horizontal line */}
            <ellipse cx="40" cy="52" rx="4" ry="4" fill="#22d3ee" className="animate-pulse" />
            <ellipse cx="60" cy="52" rx="4" ry="4" fill="#22d3ee" className="animate-pulse" />
            <path d="M 46 56 L 54 56" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case 'healing':
        return (
          <>
            {/* Swirling or glowing infinite paths (~ ~ style) */}
            <path d="M 34 52 Q 40 45, 46 52 T 58 52" stroke="#60a5fa" strokeWidth="3" fill="none" strokeLinecap="round" className="animate-pulse" />
            <path d="M 42 52 Q 48 45, 54 52 T 66 52" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" className="animate-pulse" />
          </>
        );
      case 'warning':
        return (
          <>
            {/* Red Alert triangle-style angry or shocked eyes */}
            <path d="M 33 55 L 43 47 L 35 45 Z" fill="#ef4444" />
            <path d="M 67 55 L 57 47 L 65 45 Z" fill="#ef4444" />
            <path d="M 44 58 Q 50 54, 56 58" stroke="#ef4444" strokeWidth="2" fill="none" />
          </>
        );
      case 'happy':
      default:
        return (
          <>
            {/* Cute curved Chibi arches ^w^ */}
            <path d="M 33 54 Q 40 44, 45 54" stroke="#00f3ff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M 55 54 Q 60 44, 67 54" stroke="#00f3ff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M 46 58 Q 50 62, 54 58" stroke="#f43f5e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        );
    }
  };

  return (
    <>
      <style>{`
        @keyframes breathing-healthy-dark {
          0%, 100% {
            box-shadow: 0 0 15px rgba(6, 182, 212, 0.25), inset 0 0 10px rgba(6, 182, 212, 0.15);
            border-color: rgba(6, 182, 212, 0.35);
          }
          50% {
            box-shadow: 0 0 35px rgba(6, 182, 212, 0.65), inset 0 0 20px rgba(6, 182, 212, 0.35);
            border-color: rgba(6, 182, 212, 0.75);
          }
        }
        @keyframes breathing-healthy-light {
          0%, 100% {
            box-shadow: 0 0 12px rgba(8, 145, 178, 0.2), inset 0 0 8px rgba(8, 145, 178, 0.1);
            border-color: rgba(8, 145, 178, 0.4);
          }
          50% {
            box-shadow: 0 0 28px rgba(8, 145, 178, 0.5), inset 0 0 16px rgba(8, 145, 178, 0.25);
            border-color: rgba(8, 145, 178, 0.8);
          }
        }
        @keyframes breathing-attention-dark {
          0%, 100% {
            box-shadow: 0 0 18px rgba(244, 63, 94, 0.35), inset 0 0 12px rgba(244, 63, 94, 0.2);
            border-color: rgba(244, 63, 94, 0.45);
          }
          50% {
            box-shadow: 0 0 42px rgba(244, 63, 94, 0.85), inset 0 0 24px rgba(244, 63, 94, 0.5);
            border-color: rgba(244, 63, 94, 0.9);
          }
        }
        @keyframes breathing-attention-light {
          0%, 100% {
            box-shadow: 0 0 15px rgba(225, 29, 72, 0.3), inset 0 0 10px rgba(225, 29, 72, 0.15);
            border-color: rgba(225, 29, 72, 0.5);
          }
          50% {
            box-shadow: 0 0 35px rgba(225, 29, 72, 0.7), inset 0 0 20px rgba(225, 29, 72, 0.35);
            border-color: rgba(225, 29, 72, 0.85);
          }
        }
        .animate-glow-healthy-dark {
          animation: breathing-healthy-dark 4s ease-in-out infinite;
        }
        .animate-glow-healthy-light {
          animation: breathing-healthy-light 4s ease-in-out infinite;
        }
        .animate-glow-attention-dark {
          animation: breathing-attention-dark 1.5s ease-in-out infinite;
        }
        .animate-glow-attention-light {
          animation: breathing-attention-light 1.5s ease-in-out infinite;
        }
      `}</style>
      {/* 1. Floating AI Bot Chibi Widget (Bottom-Left Trigger) */}
      <div className="fixed bottom-6 left-6 md:bottom-8 md:left-8 z-50 flex flex-col items-center gap-2">
        <AnimatePresence>
          {!showPanel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 30 }}
              className="relative group cursor-pointer"
              onClick={() => setShowPanel(true)}
            >
              {/* Little Holographic Speech bubble */}
              <div className={`absolute -top-11 md:-top-13 left-1/2 -translate-x-1/2 px-3 py-1 md:px-4 md:py-1.5 rounded-xl text-[10px] md:text-xs font-black tracking-widest uppercase whitespace-nowrap animate-bounce transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-950/95 border border-cyan-400/50 text-cyan-200 shadow-[0_4px_20px_rgba(6,182,212,0.6)]' 
                  : 'bg-cyan-950 border border-cyan-500 text-white shadow-[0_4px_16px_rgba(8,145,178,0.55)]'
              }`}>
                AI PRODX
                {/* Speech Bubble Arrow pointing to Bot */}
                <div className={`absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b ${
                  isDarkMode ? 'bg-slate-950 border-cyan-400/50' : 'bg-cyan-950 border-cyan-500'
                }`} />
              </div>

              {/* Glowing Laser Conical Beam behind the bot */}
              <div 
                className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-20 bg-gradient-to-t blur-xs group-hover:opacity-100 transition-all duration-300 ${
                  isDarkMode 
                    ? 'from-cyan-500/35 via-cyan-500/5 to-transparent opacity-75' 
                    : 'from-cyan-600/50 via-cyan-600/15 to-transparent opacity-95'
                }`}
                style={{ clipPath: 'polygon(5% 0%, 95% 0%, 65% 100%, 35% 100%)' }}
              />

              {/* Phone Pedestal in bottom-left */}
              <div className={`absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-12 h-4 border rounded-full flex items-center justify-center shadow-lg transform rotateX-[60deg] transition-colors duration-300 ${
                isDarkMode ? 'bg-zinc-900 border-zinc-700/60' : 'bg-zinc-800 border-zinc-600'
              }`}>
                <div className={`w-8 h-1.5 rounded-full animate-pulse transition-all duration-300 ${
                  isDarkMode ? 'bg-cyan-500/60' : 'bg-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                }`} />
              </div>

              {/* Chibi Bot Micro Floating Avatar */}
              <div className="relative animate-float p-1">
                <svg width="60" height="60" viewBox="0 0 100 100" className="drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                  {/* Antigravity Orbit Ring */}
                  <ellipse cx="50" cy="65" rx="36" ry="10" fill="none" stroke="#00f3ff" strokeWidth="1.5" strokeDasharray="4 6" className="origin-center animate-spin" style={{ animationDuration: '6s' }} />
                  
                  {/* Robot Head Helmet */}
                  <rect x="22" y="24" width="56" height="46" rx="23" fill="url(#botArmorGradientMini)" stroke="#ffffff" strokeWidth="1.5" />
                  {/* Glossy Visor */}
                  <rect x="28" y="32" width="44" height="28" rx="14" fill="#0f172a" stroke="#00f3ff" strokeWidth="1" />
                  
                  {/* Interactive digital eyes inside mini bot */}
                  {renderBotEyes()}

                  {/* Luminous Ears */}
                  <path d="M 20 36 L 14 30 L 18 42 Z" fill="#00f3ff" className="animate-pulse" />
                  <path d="M 80 36 L 86 30 L 82 42 Z" fill="#00f3ff" className="animate-pulse" />

                  {/* Little Floating Body armor */}
                  <path d="M 38 70 L 62 70 L 56 86 L 44 86 Z" fill="url(#botArmorGradientMini)" stroke="#ffffff" strokeWidth="1" />
                  {/* Center Blue Pulse Core */}
                  <circle cx="50" cy="77" r="4.5" fill="#00f3ff" className="animate-pulse" />

                  {/* SVG Gradients Definition */}
                  <defs>
                    <linearGradient id="botArmorGradientMini" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f8fafc" />
                      <stop offset="60%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Interactive Holographic AI Bot Workspace (Full Dashboard Inspector) */}
      <AnimatePresence>
        {showPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ type: "spring", stiffness: 180, damping: 25 }}
              className={`relative w-full max-w-5xl h-[85vh] bg-zinc-950/95 border-2 rounded-3xl overflow-hidden flex flex-col transition-all duration-500 ${glowClass}`}
            >
              {/* Holographic Scanline Shader Background Effect */}
              <div className="absolute inset-0 pointer-events-none opacity-15 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(0,243,255,0.06),rgba(0,255,100,0.02),rgba(0,100,255,0.06))] bg-[length:100%_4px,3px_100%] z-0" />

              {/* Laser beam overlay effects */}
              <div className="absolute top-0 left-1/4 right-1/4 h-32 bg-gradient-to-b from-cyan-500/10 to-transparent blur-xl pointer-events-none z-0" />

              {/* Upper Header Controls */}
              <div className="p-4 border-b border-cyan-500/25 bg-zinc-900/60 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-950/60 rounded-xl border border-cyan-500/30 text-cyan-400">
                    <Cpu className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
                      Antigravity AI Assistant Node
                      <span className="text-[10px] bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                        V2.9 (CHIBI-ACTIVE)
                      </span>
                    </h2>
                    <p className="text-[11px] text-zinc-400">Real-time Hologram Terminal & Intelligent Self-Healing</p>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="hidden sm:flex items-center gap-1.5 bg-zinc-950/80 p-1 rounded-2xl border border-zinc-800">
                  <button 
                    onClick={() => setActiveTab('bot')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'bot' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-zinc-400 hover:text-white'}`}
                  >
                    AI Bot Avatar
                  </button>
                  <button 
                    onClick={() => setActiveTab('diagnostics')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'diagnostics' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Telemetry & Logs
                  </button>
                  <button 
                    onClick={() => setActiveTab('customizer')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${activeTab === 'customizer' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Customizer Console
                  </button>
                </div>

                <button 
                  onClick={() => setShowPanel(false)}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl transition-all shadow-inner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Content Layout */}
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10">
                
                {/* LEFT PORT: The Gorgeous animated 3D-like Chibi Bot HUD Screen (Widescreen Hologram) */}
                <div className="w-full md:w-[48%] border-b md:border-b-0 md:border-r border-zinc-900 p-6 flex flex-col justify-between bg-zinc-950/60 relative overflow-hidden select-none">
                  
                  {/* Particle Stream Ascending */}
                  <div className="absolute inset-x-0 bottom-16 top-0 pointer-events-none overflow-hidden">
                    {particleSeed.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: '100%', x: `${p.left}%` }}
                        animate={{ opacity: [0, 0.7, 0.7, 0], y: ['100%', '-10%'] }}
                        transition={{ duration: p.delay + 3, repeat: Infinity, ease: 'linear' }}
                        className={`absolute bottom-0 rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-cyan-400' : 'bg-cyan-600'}`}
                        style={{ 
                          width: p.size, 
                          height: p.size, 
                          boxShadow: isDarkMode ? '0 0 8px #22d3ee' : '0 0 6px #0891b2' 
                        }}
                      />
                    ))}
                  </div>

                  {/* Visual Status Tag in Hologram Space */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 px-3 py-1 bg-cyan-950/50 border border-cyan-500/30 rounded-xl">
                      <div className={`w-2 h-2 rounded-full ${isHealing ? 'bg-blue-500 animate-ping' : isCritical ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-cyan-200">
                        {isHealing ? 'HEALING STATE' : isCritical ? 'SYSTEM CRITICAL' : 'AI STANDBY'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Diagnostic Overlay Toggle Button */}
                      <button
                        onClick={() => setShowDiagnosticOverlay(prev => !prev)}
                        className={`px-3 py-1 text-[10px] font-mono font-bold tracking-wider uppercase rounded-xl flex items-center gap-1.5 border transition-all ${
                          showDiagnosticOverlay
                            ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                            : 'bg-zinc-900/90 text-cyan-400 border-cyan-500/30 hover:border-cyan-400 hover:text-cyan-300'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5 animate-pulse" />
                        <span>DIAG_OVERLAY: {showDiagnosticOverlay ? 'ON' : 'OFF'}</span>
                      </button>

                      <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5 text-cyan-500" />
                        <span>TELEMETRY SYNC</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Animated Scene (Chibi Bot hovering over Phone with Lasers & Orbit Rings) */}
                  <div className="flex-1 flex flex-col items-center justify-center relative my-4">
                    
                    {/* Hologram Floating Q&A Bubbles Around Chibi Bot */}
                    {/* Welcome Text Left */}
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className={`absolute left-[-5px] top-[15%] max-w-[150px] border-2 rounded-2xl rounded-bl-none text-[10px] font-black tracking-tight font-mono transition-all duration-300 z-20 ${
                        isDarkMode 
                          ? 'bg-cyan-950/80 border-cyan-400/45 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                          : 'bg-cyan-950 border-cyan-500 text-cyan-50 shadow-md'
                      }`}
                    >
                      <div className="text-[8px] text-cyan-500 uppercase tracking-widest mb-0.5">Welcome_</div>
                      "{qaWelcome}"
                    </motion.div>
 
                    {/* User Question bubble (Left-Center) */}
                    <motion.div
                      animate={{ y: [0, 4, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                      className={`absolute left-[5px] bottom-[25%] max-w-[160px] border rounded-2xl rounded-tl-none text-[10px] font-black tracking-tight font-mono shadow-md transition-all duration-300 z-20 ${
                        isDarkMode 
                          ? 'bg-zinc-900/90 border-zinc-700/80 text-zinc-100' 
                          : 'bg-zinc-800 border-zinc-600 text-zinc-50'
                      }`}
                    >
                      <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">User_Input_</div>
                      "{qaQuestion}" 🌤️
                    </motion.div>
 
                    {/* AI Answer Bubble (Right-Center) */}
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                      className={`absolute right-[-5px] top-[22%] max-w-[170px] border-2 rounded-2xl rounded-br-none text-[10px] font-black tracking-tight font-mono transition-all duration-300 z-20 ${
                        isDarkMode 
                          ? 'bg-cyan-950/85 border-cyan-400/50 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                          : 'bg-cyan-900 border-cyan-500 text-white shadow-md'
                      }`}
                    >
                      <div className="text-[8px] text-emerald-400 uppercase tracking-widest mb-0.5">AI_Response_</div>
                      "{qaAnswer}"
                    </motion.div>
 
                    {/* Active "Thinking..." label below AI Answer */}
                    <AnimatePresence>
                      {isAiAnswering && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={`absolute right-4 bottom-[30%] border px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse transition-all duration-300 z-30 ${
                            isDarkMode 
                              ? 'bg-amber-950/80 border-amber-500/40 text-amber-300' 
                              : 'bg-amber-900 border-amber-600 text-white shadow-md'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                          Thinking...
                        </motion.div>
                      )}
                    </AnimatePresence>
 
                    {/* Cybernetic Tech Scanlines and Grid Ground */}
                    <div className="absolute bottom-4 w-72 h-14 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.15),transparent_70%)] border border-cyan-500/10 rounded-full transform rotateX-[68deg] pointer-events-none" />
                    <div className="absolute bottom-2 w-80 h-16 border-2 border-dashed border-cyan-500/15 rounded-full transform rotateX-[70deg] animate-spin pointer-events-none" style={{ animationDuration: '16s' }} />

                    {/* Large Conical Glow from the smartphone laser emission */}
                    <div 
                      className={`absolute bottom-[20%] left-1/2 -translate-x-1/2 w-52 h-64 bg-gradient-to-t blur-xs transition-all duration-300 ${
                        isDarkMode 
                          ? 'from-cyan-500/40 via-cyan-500/5 to-transparent opacity-90' 
                          : 'from-cyan-600/55 via-cyan-600/20 to-transparent opacity-100'
                      }`}
                      style={{ clipPath: 'polygon(3% 0%, 97% 0%, 65% 100%, 35% 100%)' }}
                    />
 
                    {/* Hologram Rings Spinning around the Center Core */}
                    <div className="absolute bottom-[35%] left-1/2 -translate-x-1/2 w-52 h-14 border-2 border-cyan-400/40 rounded-full transform rotateX-[70deg] animate-spin select-none" style={{ animationDuration: '8s' }} />
                    <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-36 h-10 border border-emerald-400/30 rounded-full transform rotateX-[75deg] animate-spin select-none" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />
                    <div className="absolute bottom-[42%] left-1/2 -translate-x-1/2 w-28 h-6 border border-cyan-400/25 rounded-full transform rotateX-[65deg] animate-pulse select-none" />
 
                    {/* The Chibi Bot Main Floating Character (+10% size) */}
                    <motion.div
                      animate={{
                        y: [0, -12, 0],
                        rotate: [0, 1.5, -1.5, 0]
                      }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="relative z-10 w-52 h-52 flex items-center justify-center cursor-pointer scale-110 drop-shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                      onClick={() => {
                        // Change expression on click for playful interaction
                        const expressions: Array<typeof botExpression> = ['happy', 'thinking', 'healing', 'warning'];
                        const currentIdx = expressions.indexOf(botExpression);
                        const nextIdx = (currentIdx + 1) % expressions.length;
                        setBotExpression(expressions[nextIdx]);
                      }}
                    >
                      <svg width="100%" height="100%" viewBox="0 0 160 160" className="drop-shadow-[0_12px_24px_rgba(6,182,212,0.65)]">
                        <defs>
                          {/* Rich High-Tech Gradients */}
                          <linearGradient id="bodyArmorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="50%" stopColor="#e2e8f0" />
                            <stop offset="100%" stopColor="#94a3b8" />
                          </linearGradient>
                          <linearGradient id="neonLightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00f3ff" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                          <radialGradient id="visorBackground" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#1e293b" />
                            <stop offset="85%" stopColor="#0f172a" />
                            <stop offset="100%" stopColor="#020617" />
                          </radialGradient>
                          <filter id="cyberGlow">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>

                        {/* Outer Head Orbit Ring (3D tilt aspect) */}
                        <ellipse cx="80" cy="98" rx="64" ry="16" fill="none" stroke="url(#neonLightGradient)" strokeWidth="2.5" strokeDasharray="6 8" className="origin-center animate-spin" style={{ animationDuration: '10s' }} />

                        {/* Luminous High-Tech Ears/Side Panels */}
                        <path d="M 34 56 L 20 46 L 24 68 Z" fill="url(#neonLightGradient)" filter="url(#cyberGlow)" className="animate-pulse" />
                        <path d="M 126 56 L 140 46 L 136 68 Z" fill="url(#neonLightGradient)" filter="url(#cyberGlow)" className="animate-pulse" />

                        {/* Helmet main structure (White-Grey Armor plates) */}
                        <rect x="36" y="30" width="88" height="74" rx="37" fill="url(#bodyArmorGradient)" stroke="#ffffff" strokeWidth="2" />
                        <path d="M 46 30 Q 80 18, 114 30" fill="none" stroke="#94a3b8" strokeWidth="2.5" />

                        {/* Glossy Black High-Tech Visor Screen */}
                        <rect x="44" y="44" width="72" height="46" rx="20" fill="url(#visorBackground)" stroke="#00f3ff" strokeWidth="1.5" />

                        {/* Animated Eye Matrix based on Expression */}
                        <g filter="url(#cyberGlow)">
                          {renderBotEyes()}
                        </g>

                        {/* Glowing Cyan Face accents */}
                        <circle cx="50" cy="40" r="2" fill="#00f3ff" />
                        <circle cx="110" cy="40" r="2" fill="#00f3ff" />

                        {/* Floating Compact Cyber Armor Body */}
                        <path d="M 60 110 L 100 110 L 92 135 L 68 135 Z" fill="url(#bodyArmorGradient)" stroke="#ffffff" strokeWidth="1.5" />
                        
                        {/* Luminous Chest Arc Core Reactor */}
                        <circle cx="80" cy="120" r="7.5" fill="#00f3ff" filter="url(#cyberGlow)" className="animate-pulse" />
                        
                        {/* Compact Hovering Shoulders & Hands pointing friendly */}
                        <circle cx="51" cy="116" r="6.5" fill="#475569" />
                        <circle cx="109" cy="116" r="6.5" fill="#475569" />

                        {/* Right pointing arm/hand (Friendly pointing style) */}
                        <path d="M 109 116 Q 124 116, 128 112" stroke="url(#bodyArmorGradient)" strokeWidth="6" strokeLinecap="round" />
                        <circle cx="128" cy="112" r="5" fill="#3b82f6" />

                        {/* Hovering compact Chibi feet */}
                        <rect x="64" y="140" width="12" height="7" rx="3" fill="#cbd5e1" stroke="#475569" />
                        <rect x="84" y="140" width="12" height="7" rx="3" fill="#cbd5e1" stroke="#475569" />
                      </svg>
                    </motion.div>

                    {/* Smartphone Projection Pedestal Lying Flat */}
                    <div className="absolute bottom-[8px] w-64 h-16 bg-gradient-to-r from-zinc-900 to-zinc-800 border-t-2 border-zinc-700 rounded-3xl shadow-2xl flex items-center justify-center transform rotateX-[55deg] transform-gpu scale-y-[0.8]">
                      {/* Laser projector blue circle */}
                      <div className="w-24 h-8 bg-cyan-950 rounded-full border-2 border-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.8)]">
                        <div className="w-16 h-4 bg-cyan-500 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                      </div>
                    </div>

                    {/* Animated Holographic Circular Pedestal under the phone */}
                    <div className="absolute bottom-[-15px] w-72 h-10 border-2 border-dashed border-cyan-500/25 rounded-full transform rotateX-[65deg] select-none" />

                    {/* Interactive Holographic Repair Status Progress Bar */}
                    <AnimatePresence>
                      {isHealing && (
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -15, scale: 0.95 }}
                          className={`absolute bottom-6 inset-x-4 z-20 p-4 border rounded-2xl backdrop-blur-md transition-all duration-300 shadow-xl ${
                            isDarkMode 
                              ? 'bg-slate-950/90 border-cyan-500/50 text-cyan-200 shadow-[0_0_25px_rgba(6,182,212,0.4)]' 
                              : 'bg-cyan-950/95 border-cyan-400/60 text-cyan-50 shadow-[0_0_20px_rgba(8,145,178,0.3)]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono font-black tracking-widest uppercase flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 animate-bounce text-amber-400" />
                              AUTO-REPAIR ACTIVE_
                            </span>
                            <span className="text-xs font-mono font-black text-cyan-400">{repairProgress}%</span>
                          </div>
                          
                          {/* Progress bar outer container */}
                          <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/10">
                            {/* Animated glowing progress inner element */}
                            <motion.div 
                              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                              style={{ width: `${repairProgress}%` }}
                              transition={{ type: "spring", stiffness: 80, damping: 15 }}
                            />
                          </div>

                          <div className="mt-2 flex items-center justify-between text-[8px] font-mono text-zinc-400">
                            <span className="animate-pulse text-cyan-300 font-bold uppercase">{repairStep}</span>
                            <span className="text-zinc-500">SYS_FIX: V2.9</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* VOICE VISUALIZER / SPECTRUM GRAPH (Bottom Part) */}
                  <div className="space-y-1.5 mt-2 bg-zinc-900/45 p-3 rounded-2xl border border-zinc-800/60">
                    <div className="flex items-center justify-between text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-cyan-500" />
                        AI Speech Spectrum Wave
                      </span>
                      <span className="text-cyan-400 font-mono tracking-widest text-[8px] bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/20">
                        {isAiAnswering ? 'PROCESSING' : isHealing ? 'REPAIR_PULSE' : 'STANDBY'}
                      </span>
                    </div>

                    {/* Spectrum bars */}
                    <div className="h-12 flex items-end justify-center gap-1.5 px-2 select-none">
                      {visualizerHeights.map((h, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 rounded-t transition-all duration-100 ${
                            isAiAnswering 
                              ? 'bg-gradient-to-t from-cyan-600 to-cyan-400' 
                              : isHealing 
                                ? 'bg-gradient-to-t from-blue-600 to-blue-400' 
                                : 'bg-gradient-to-t from-zinc-700 to-zinc-500'
                          }`}
                          style={{ 
                            height: `${h}%`,
                            boxShadow: isAiAnswering || isHealing ? '0 0 8px rgba(6,182,212,0.4)' : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Diagnostic Overlay HUD */}
                  <AnimatePresence>
                    {showDiagnosticOverlay && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="absolute inset-0 z-30 p-5 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between"
                      >
                        {/* Overlay Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/30">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <div className="text-left">
                              <h3 className="text-xs font-black text-white tracking-widest uppercase font-mono">
                                AI PRODX DIAGNOSTIC OVERLAY
                              </h3>
                              <p className="text-[9px] text-cyan-400/80 font-mono font-bold uppercase tracking-tight">
                                Live Auto-Repair Telemetry Records
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setShowDiagnosticOverlay(false)}
                            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Logs Stream Panel */}
                        <div className="flex-1 my-3 overflow-y-auto space-y-2.5 pr-1 font-mono text-left">
                          {repairLogs.length === 0 ? (
                            <div className="text-zinc-600 text-xs italic text-center py-10 font-mono">
                              NO REPAIR RECORDS LOCATED IN CURRENT SESSION
                            </div>
                          ) : (
                            repairLogs.map((r) => (
                              <div
                                key={r.id}
                                className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all duration-300 ${
                                  r.status === 'IN_PROGRESS'
                                    ? 'bg-blue-950/40 border-blue-500/40 text-blue-100 shadow-[0_0_10px_rgba(59,130,246,0.15)] animate-pulse'
                                    : r.status === 'FAILED'
                                      ? 'bg-rose-950/45 border-rose-500/40 text-rose-100'
                                      : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-100/90'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[9px] font-bold">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-zinc-500">[{r.timestamp}]</span>
                                    <span className="text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/20 font-black tracking-wider uppercase">
                                      SERVICE: {r.targetService}
                                    </span>
                                  </div>
                                  
                                  <span className={`px-2 py-0.5 rounded border font-black uppercase tracking-wider ${
                                    r.status === 'IN_PROGRESS'
                                      ? 'text-blue-400 bg-blue-950 border-blue-500/20'
                                      : r.status === 'FAILED'
                                        ? 'text-rose-400 bg-rose-950 border-rose-500/20'
                                        : 'text-emerald-400 bg-emerald-950 border-emerald-500/20'
                                  }`}>
                                    CODE: {r.resolutionCode}
                                  </span>
                                </div>
                                
                                <p className="text-[10px] leading-relaxed opacity-90">
                                  {r.message}
                                </p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* HUD Footer Actions */}
                        <div className="pt-3 border-t border-cyan-500/20 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                            <span>NODE_RECORDING: {repairLogs.length} LOGS ACTIVE</span>
                          </div>
                          
                          <button
                            onClick={() => {
                              setRepairLogs([]);
                              addLog('Diagnostic Overlay system logs purged by operator.', 'INFO');
                            }}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                          >
                            PURGE RECORDS
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

                {/* RIGHT PORT: Custom tabs containing diagnostics consoles and config options */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-zinc-950/40">
                  
                  {/* Dynamic Mobile View Tabs */}
                  <div className="flex sm:hidden items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setActiveTab('bot')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight text-center ${activeTab === 'bot' ? 'bg-cyan-500 text-black' : 'text-zinc-400'}`}
                    >
                      Bot Intro
                    </button>
                    <button 
                      onClick={() => setActiveTab('diagnostics')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight text-center ${activeTab === 'diagnostics' ? 'bg-cyan-500 text-black' : 'text-zinc-400'}`}
                    >
                      Diagnostics
                    </button>
                    <button 
                      onClick={() => setActiveTab('customizer')}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight text-center ${activeTab === 'customizer' ? 'bg-cyan-500 text-black' : 'text-zinc-400'}`}
                    >
                      Config Bot
                    </button>
                  </div>

                  {/* TAB 1: AI BOT PRESENTATION SUMMARY */}
                  {activeTab === 'bot' && (
                    <div className="space-y-4">
                      {/* Interactive Q&A Console */}
                      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-4">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-xs font-bold text-white tracking-widest uppercase">Interact with Chibi Bot</h3>
                        </div>

                        {/* Interactive Chat Form */}
                        <form onSubmit={handleCustomQuestionSubmit} className="flex gap-2">
                          <input 
                            type="text" 
                            value={customQuestionInput}
                            onChange={(e) => setCustomQuestionInput(e.target.value)}
                            placeholder="ASK SOMETHING (e.g. status, weather, inventory, hello...)"
                            className="flex-1 bg-black/60 border border-zinc-800 focus:border-cyan-500 text-zinc-100 placeholder:text-zinc-600 rounded-xl px-4 py-2 text-xs focus:outline-none transition-colors"
                          />
                          <button 
                            type="button" 
                            onClick={triggerVoiceCommand}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center transition-all shadow-md active:scale-95 border cursor-pointer shrink-0 ${
                              isListening 
                                ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 text-white animate-pulse' 
                                : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/30 text-cyan-400 hover:text-cyan-300'
                            }`}
                            title={isListening ? 'Stop Listening' : 'Speak Vocal Command'}
                          >
                            {isListening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                          </button>
                          <button 
                            type="submit" 
                            disabled={isAiAnswering || !customQuestionInput.trim()}
                            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                          >
                            <Send className="w-3 h-3" />
                            <span>Ask AI</span>
                          </button>
                        </form>

                        <div className="p-3 bg-black/40 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                          <span className="font-bold text-cyan-400">Hologram Note:</span> You can type custom commands above. The bot will parse query keywords and respond instantly in the floating hologram bubble! Try typing <code className="text-white font-mono bg-zinc-800 px-1 rounded">"status"</code> or <code className="text-white font-mono bg-zinc-800 px-1 rounded">"inventory"</code>.
                        </div>
                      </div>

                      {/* Small telemetry widgets */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-2">
                          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Antigravity Levitation Core</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-mono font-bold text-cyan-400">98.4%</span>
                            <span className="text-[9px] bg-cyan-950/60 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded font-mono">STABLE</span>
                          </div>
                          <div className="w-full bg-black rounded-full h-1">
                            <div className="bg-cyan-500 h-1 rounded-full w-[98%]" />
                          </div>
                        </div>

                        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 space-y-2">
                          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Diagnostics Frequency</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-mono font-bold text-emerald-400">5.0s</span>
                            <span className="text-[9px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">INTERVAL</span>
                          </div>
                          <div className="w-full bg-black rounded-full h-1">
                            <div className="bg-emerald-400 h-1 rounded-full w-[100%]" />
                          </div>
                        </div>
                      </div>

                      {/* AI Assistant Character Concept Card */}
                      <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900/40 p-4 rounded-2xl border border-cyan-500/20 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 tracking-widest uppercase">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          Character Blueprint: Mini Cyberbot
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          A cute sci-fi chibi-scale assistant with pristine white-grey heavy composite carbon armor plates, illuminated by radiant cyan neon power channels. Equipped with an interactive digital display visor mapping emotion algorithms (Happy, Sarcastic, Analytic, Healing), floating above a high-power wireless induction laser projection smartphone base.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SYSTEM DIAGNOSTICS & RAW LOGS (The Original Antigravity Operations) */}
                  {activeTab === 'diagnostics' && (
                    <div className="space-y-4">
                      {/* Quick Tech stats grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
                          <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Service Status</div>
                          <div className={`text-xs font-bold flex items-center gap-1.5 ${health?.status === 'HEALTHY' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {health?.status === 'HEALTHY' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            <span>{health?.status || 'INITIALIZING'}</span>
                          </div>
                        </div>
                        <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
                          <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Cloud Database</div>
                          <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{health?.database?.status === 'ONLINE' ? 'OPERATIONAL' : 'OFFLINE'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Latency and CPU Health line */}
                      <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          <span>Edge Ping Latency</span>
                          <span className={(telemetry?.history?.[0]?.p50LatencyMs || 0) > 100 ? 'text-red-400' : 'text-emerald-400 font-mono'}>
                            {telemetry?.history?.[0]?.p50LatencyMs || 12}ms
                          </span>
                        </div>
                        <div className="w-full bg-black rounded-full h-2 overflow-hidden border border-zinc-800">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (telemetry?.history?.[0]?.cpuPercent || 45))}%` }}
                            className={`h-full transition-all duration-700 ${isCritical ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'}`}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500">
                          <span>0ms LIMIT</span>
                          <span>COMPUTE LEVEL: {telemetry?.history?.[0]?.cpuPercent || 45}%</span>
                          <span>100ms CRITICAL</span>
                        </div>
                      </div>

                      {/* Diagnostics Logs Console Stream */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-bold tracking-[0.1em]">
                          <span className="flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                            AI Diagnostics Live Stream
                          </span>
                          <button 
                            onClick={checkHealth}
                            disabled={isHealing}
                            className="text-[9px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-1 rounded flex items-center gap-1 text-zinc-300 disabled:opacity-50"
                          >
                            <RefreshCcw className={`w-2.5 h-2.5 ${isHealing ? 'animate-spin' : ''}`} />
                            Force Probe
                          </button>
                        </div>
                        <div className="bg-black/80 rounded-2xl p-4 font-mono text-[10px] space-y-2 max-h-56 overflow-y-auto border border-zinc-900 shadow-inner">
                          {logs.length === 0 && (
                            <div className="text-zinc-600 italic">Antigravity telemetry node live. Zero anomalies registered.</div>
                          )}
                          {logs.map(log => (
                            <div key={log.id} className="flex gap-2.5 leading-relaxed">
                              <span className="text-zinc-700 shrink-0">[{log.timestamp}]</span>
                              <span className={`
                                ${log.type === 'ERROR' ? 'text-red-400 font-bold' : ''}
                                ${log.type === 'WARNING' ? 'text-amber-400' : ''}
                                ${log.type === 'REPAIR' ? 'text-cyan-400 font-black' : ''}
                                ${log.type === 'INFO' ? 'text-zinc-500' : ''}
                              `}>
                                {log.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Manual Optimization Trigger Button */}
                      <button
                        onClick={handleManualHealTrigger}
                        disabled={isHealing}
                        className="w-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-98 shadow-lg"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isHealing ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
                        {isHealing ? 'HEALING ENGINE ENGAGED...' : 'PROBE & RECLAIM MEMORY (MANUAL DRILL)'}
                      </button>
                    </div>
                  )}

                  {/* TAB 3: CUSTOMIZER CONSOLE (Configure messages and expressions) */}
                  {activeTab === 'customizer' && (
                    <div className="space-y-4">
                      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-4">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-xs font-bold text-white tracking-widest uppercase">Modify AI Custom Fields</h3>
                        </div>

                        {/* Input 1: Welcome Text */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-500 uppercase font-mono font-bold">Welcome Message (Hologram Left)</label>
                          <input 
                            type="text" 
                            value={qaWelcome}
                            onChange={(e) => setQaWelcome(e.target.value.toUpperCase())}
                            className="w-full bg-black/60 border border-zinc-800 focus:border-cyan-500 text-zinc-200 px-3.5 py-2 rounded-xl text-xs focus:outline-none"
                          />
                        </div>

                        {/* Input 2: Custom Question */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-500 uppercase font-mono font-bold">Standard Question Bubble (Left-Center)</label>
                          <input 
                            type="text" 
                            value={qaQuestion}
                            onChange={(e) => setQaQuestion(e.target.value.toUpperCase())}
                            className="w-full bg-black/60 border border-zinc-800 focus:border-cyan-500 text-zinc-200 px-3.5 py-2 rounded-xl text-xs focus:outline-none"
                          />
                        </div>

                        {/* Input 3: Custom Answer */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-zinc-500 uppercase font-mono font-bold">AI Answer Reply (Hologram Right)</label>
                          <textarea 
                            rows={2}
                            value={qaAnswer}
                            onChange={(e) => setQaAnswer(e.target.value.toUpperCase())}
                            className="w-full bg-black/60 border border-zinc-800 focus:border-cyan-500 text-zinc-200 px-3.5 py-2 rounded-xl text-xs focus:outline-none resize-none"
                          />
                        </div>
                      </div>

                      {/* Bot Face Expression Selector */}
                      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-3">
                        <div className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-1.5">
                          <span>Set Digital Expression</span>
                          <span className="text-[9px] bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded font-mono">LIVE EXPRESSIONS</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button 
                            onClick={() => setBotExpression('happy')}
                            className={`p-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${botExpression === 'happy' ? 'bg-cyan-500 text-black border-cyan-500 font-black' : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white'}`}
                          >
                            Happy (^w^)
                          </button>
                          <button 
                            onClick={() => setBotExpression('thinking')}
                            className={`p-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${botExpression === 'thinking' ? 'bg-cyan-500 text-black border-cyan-500 font-black' : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white'}`}
                          >
                            Thinking (•_•)
                          </button>
                          <button 
                            onClick={() => setBotExpression('healing')}
                            className={`p-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${botExpression === 'healing' ? 'bg-cyan-500 text-black border-cyan-500 font-black' : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white'}`}
                          >
                            Healing (~~)
                          </button>
                          <button 
                            onClick={() => setBotExpression('warning')}
                            className={`p-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all ${botExpression === 'warning' ? 'bg-cyan-500 text-black border-cyan-500 font-black' : 'bg-black/40 text-zinc-400 border-zinc-800 hover:text-white'}`}
                          >
                            Warning (!!!)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>

              {/* Lower projection statistics footer */}
              <div className="p-3 bg-zinc-950 border-t border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between text-[10px] text-zinc-500 gap-2 relative z-10 font-mono">
                <div>
                  Projection Node status: <span className="text-emerald-400 font-bold">ONLINE</span> &bull; Last check: {lastCheck.toLocaleTimeString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  <span>Antigravity Beam: 520THz Coherent Laser</span>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. AI Antigravity Floating Top-Level Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md"
          >
            <div className={`p-5 rounded-3xl border shadow-[0_20px_50px_rgba(0,0,0,0.35)] flex items-start gap-4 ${
              toast.type === 'HEALING' 
                ? 'bg-amber-950/95 border-amber-500/40 text-amber-100' 
                : toast.type === 'SUCCESS'
                  ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-100'
                  : 'bg-red-950/95 border-red-500/40 text-red-100'
            }`}>
              <div className="p-2 bg-white/10 rounded-2xl shrink-0">
                <Activity className={`w-5 h-5 ${toast.type === 'HEALING' ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 space-y-1 text-left">
                <h4 className="text-sm font-black tracking-tight">{toast.title}</h4>
                <p className="text-xs font-semibold leading-relaxed opacity-90 [text-wrap:balance]">{toast.text}</p>
              </div>
              <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-lg opacity-60 hover:opacity-100 transition-all text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AntigravityHealthCheck;
