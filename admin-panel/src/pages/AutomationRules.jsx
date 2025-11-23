import { useState } from 'react';
import {
  Plus,
  Settings,
  Trash2,
  Power,
  PowerOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Automation Rules Engine
 * Define rules for auto-approval/rejection based on conditions
 */
export default function AutomationRules() {
  const [rules, setRules] = useState([
    {
      id: 1,
      name: 'Düşük Riskli Otomatik Onayla',
      enabled: true,
      conditions: [
        { field: 'fraudScore', operator: '<', value: '20' },
        { field: 'amount', operator: '<', value: '5000' },
      ],
      action: 'approve',
      priority: 1,
    },
    {
      id: 2,
      name: 'Kritik Risk Otomatik Reddet',
      enabled: true,
      conditions: [{ field: 'fraudScore', operator: '>', value: '75' }],
      action: 'reject',
      priority: 2,
    },
    {
      id: 3,
      name: 'Yüksek Tutarlı Manuel İnceleme',
      enabled: false,
      conditions: [{ field: 'amount', operator: '>', value: '50000' }],
      action: 'flag',
      priority: 3,
    },
  ]);

  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    conditions: [{ field: 'fraudScore', operator: '<', value: '' }],
    action: 'approve',
  });

  const toggleRule = (id) => {
    setRules(
      rules.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
    const rule = rules.find((r) => r.id === id);
    toast.success(
      `Kural "${rule.name}" ${!rule.enabled ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`
    );
  };

  const deleteRule = (id) => {
    const rule = rules.find((r) => r.id === id);
    if (window.confirm(`"${rule.name}" kuralını silmek istediğinize emin misiniz?`)) {
      setRules(rules.filter((r) => r.id !== id));
      toast.success('Kural silindi');
    }
  };

  const addCondition = () => {
    setNewRule({
      ...newRule,
      conditions: [
        ...newRule.conditions,
        { field: 'fraudScore', operator: '<', value: '' },
      ],
    });
  };

  const removeCondition = (index) => {
    setNewRule({
      ...newRule,
      conditions: newRule.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (index, field, value) => {
    const updatedConditions = [...newRule.conditions];
    updatedConditions[index][field] = value;
    setNewRule({ ...newRule, conditions: updatedConditions });
  };

  const saveNewRule = () => {
    if (!newRule.name) {
      toast.error('Kural adı gerekli');
      return;
    }

    if (newRule.conditions.some((c) => !c.value)) {
      toast.error('Tüm koşul değerlerini doldurun');
      return;
    }

    const rule = {
      id: rules.length + 1,
      ...newRule,
      enabled: true,
      priority: rules.length + 1,
    };

    setRules([...rules, rule]);
    setShowNewRule(false);
    setNewRule({
      name: '',
      conditions: [{ field: 'fraudScore', operator: '<', value: '' }],
      action: 'approve',
    });
    toast.success('Yeni kural eklendi');
  };

  const getActionBadge = (action) => {
    const styles = {
      approve: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircle2,
        label: 'Otomatik Onayla',
      },
      reject: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: XCircle,
        label: 'Otomatik Reddet',
      },
      flag: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: AlertTriangle,
        label: 'Manuel İnceleme',
      },
    };

    const style = styles[action];
    const Icon = style.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${style.bg} ${style.text}`}
      >
        <Icon className="w-4 h-4" />
        {style.label}
      </span>
    );
  };

  const fieldLabels = {
    fraudScore: 'Fraud Skoru',
    amount: 'Tutar (₺)',
    customerEmail: 'Müşteri E-posta',
    hour: 'Saat',
  };

  const operatorLabels = {
    '<': 'Küçüktür',
    '>': 'Büyüktür',
    '==': 'Eşittir',
    '!=': 'Eşit Değildir',
    contains: 'İçerir',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Otomasyon Kuralları
          </h1>
          <p className="text-gray-600">
            Koşullara göre otomatik onay/red kuralları tanımlayın
          </p>
        </div>
        <button
          onClick={() => setShowNewRule(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Yeni Kural
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">
              Otomasyon Nasıl Çalışır?
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Kurallar öncelik sırasına göre değerlendirilir (yukarıdan
                aşağıya)
              </li>
              <li>
                • İlk eşleşen kural uygulanır ve diğer kurallar atlanır
              </li>
              <li>• Bir koşul grubu içindeki tüm koşullar sağlanmalıdır (VE mantığı)</li>
              <li>• Kritik işlemlerde her zaman manuel kontrol önerilir</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div
            key={rule.id}
            className={`bg-white rounded-lg shadow-md border-2 overflow-hidden transition-all ${
              rule.enabled ? 'border-blue-200' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg font-bold text-gray-600">
                    #{rule.priority}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {rule.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getActionBadge(rule.action)}
                      {rule.enabled ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                          <Power className="w-4 h-4" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                          <PowerOff className="w-4 h-4" />
                          Pasif
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-2 rounded-lg transition ${
                      rule.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={rule.enabled ? 'Devre Dışı Bırak' : 'Etkinleştir'}
                  >
                    {rule.enabled ? (
                      <Power className="w-5 h-5" />
                    ) : (
                      <PowerOff className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                    title="Sil"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Conditions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Koşullar (Tümü sağlanmalı):
                </h4>
                <div className="space-y-2">
                  {rule.conditions.map((condition, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm bg-white p-3 rounded-lg"
                    >
                      <span className="font-semibold text-gray-900">
                        {fieldLabels[condition.field]}
                      </span>
                      <span className="text-gray-600">
                        {operatorLabels[condition.operator]}
                      </span>
                      <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono">
                        {condition.value}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Rule Modal */}
      {showNewRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                Yeni Otomasyon Kuralı
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kural Adı
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) =>
                    setNewRule({ ...newRule, name: e.target.value })
                  }
                  placeholder="Örn: Düşük Tutarlı Otomatik Onayla"
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eylem
                </label>
                <select
                  value={newRule.action}
                  onChange={(e) =>
                    setNewRule({ ...newRule, action: e.target.value })
                  }
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="approve">Otomatik Onayla</option>
                  <option value="reject">Otomatik Reddet</option>
                  <option value="flag">Manuel İncelemeye Gönder</option>
                </select>
              </div>

              {/* Conditions */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Koşullar
                  </label>
                  <button
                    onClick={addCondition}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    + Koşul Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {newRule.conditions.map((condition, index) => (
                    <div
                      key={index}
                      className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg"
                    >
                      <select
                        value={condition.field}
                        onChange={(e) =>
                          updateCondition(index, 'field', e.target.value)
                        }
                        className="flex-1 p-2 border rounded-lg text-sm"
                      >
                        <option value="fraudScore">Fraud Skoru</option>
                        <option value="amount">Tutar (₺)</option>
                        <option value="hour">Saat</option>
                      </select>

                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(index, 'operator', e.target.value)
                        }
                        className="p-2 border rounded-lg text-sm"
                      >
                        <option value="<">{'<'}</option>
                        <option value=">">{'>'}</option>
                        <option value="==">{'='}</option>
                        <option value="!=">{'≠'}</option>
                      </select>

                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) =>
                          updateCondition(index, 'value', e.target.value)
                        }
                        placeholder="Değer"
                        className="flex-1 p-2 border rounded-lg text-sm"
                      />

                      {newRule.conditions.length > 1 && (
                        <button
                          onClick={() => removeCondition(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowNewRule(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                İptal
              </button>
              <button
                onClick={saveNewRule}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Kuralı Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
