import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

/**
 * Bank Statement Import Wizard
 * Upload Excel/CSV, auto-match transactions, bulk approve
 */
export default function StatementImport() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [matchResults, setMatchResults] = useState(null);
  const [selectedMatches, setSelectedMatches] = useState([]);

  // Handle file drop/select
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (!validTypes.includes(selectedFile.type) &&
          !selectedFile.name.match(/\.(csv|xls|xlsx)$/i)) {
        toast.error('Lütfen CSV veya Excel dosyası yükleyin');
        return;
      }

      setFile(selectedFile);
      toast.success(`Dosya seçildi: ${selectedFile.name}`);
    }
  };

  // Process and match transactions
  const handleProcess = async () => {
    if (!file) {
      toast.error('Lütfen bir dosya seçin');
      return;
    }

    setImporting(true);
    toast.loading('Ekstre işleniyor...', { id: 'import' });

    // Simulate processing (in real app, would send to backend)
    setTimeout(() => {
      // Mock matched transactions
      const mockMatches = Array.from({ length: 15 }, (_, i) => {
        const matched = Math.random() > 0.2; // 80% match rate
        const amount = Math.floor(Math.random() * 50000) + 1000;

        return {
          id: `match_${i}`,
          statementData: {
            date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            amount: amount,
            description: `PAY${(100000 + i).toString()}`,
            sender: `Müşteri ${i + 1}`,
          },
          matchedTransaction: matched ? {
            id: `tx_${i}`,
            refCode: `PAY${(100000 + i).toString()}`,
            amount: amount,
            customerName: `Müşteri ${i + 1}`,
            status: 'PENDING',
          } : null,
          matchConfidence: matched ? (Math.random() * 30 + 70) : 0, // 70-100%
          status: matched ? 'matched' : 'unmatched',
        };
      });

      setMatchResults(mockMatches);
      setImporting(false);
      toast.success(`${mockMatches.filter(m => m.status === 'matched').length} eşleşme bulundu!`, { id: 'import' });
    }, 2000);
  };

  // Bulk approve matched transactions
  const handleBulkApprove = async () => {
    const toApprove = matchResults
      .filter(m => m.status === 'matched' && m.matchedTransaction)
      .filter(m => selectedMatches.includes(m.id));

    if (toApprove.length === 0) {
      toast.error('Onaylanacak işlem seçin');
      return;
    }

    toast.loading(`${toApprove.length} işlem onaylanıyor...`, { id: 'bulk' });

    // Simulate bulk approval
    setTimeout(() => {
      toast.success(`${toApprove.length} işlem başarıyla onaylandı!`, { id: 'bulk' });
      queryClient.invalidateQueries(['pending-payments']);
      setSelectedMatches([]);
      setMatchResults(null);
      setFile(null);
    }, 2000);
  };

  // Toggle selection
  const toggleSelection = (matchId) => {
    setSelectedMatches(prev =>
      prev.includes(matchId)
        ? prev.filter(id => id !== matchId)
        : [...prev, matchId]
    );
  };

  // Select all matched
  const selectAllMatched = () => {
    const allMatched = matchResults
      .filter(m => m.status === 'matched')
      .map(m => m.id);
    setSelectedMatches(allMatched);
  };

  // Download template
  const downloadTemplate = () => {
    const csvContent = `Tarih,Tutar,Açıklama,Gönderen
2024-01-15,15000,PAY123456,Ahmet Yılmaz
2024-01-15,25000,PAY123457,Mehmet Demir`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ekstre_sablonu.csv';
    link.click();
    toast.success('Şablon indirildi');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Banka Ekstresi İçe Aktarma
        </h1>
        <p className="text-gray-600">
          Excel veya CSV dosyanızı yükleyin, otomatik eşleştirme yapın
        </p>
      </div>

      {/* Upload Section */}
      {!matchResults && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="max-w-3xl mx-auto">
            {/* Template Download */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  İlk kez mi kullanıyorsunuz?
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Şablon dosyasını indirip kendi verilerinizle doldurun
                </p>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Şablon İndir (CSV)
                </button>
              </div>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 transition">
              <input
                type="file"
                id="file-upload"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="mb-4 p-4 bg-blue-50 rounded-full">
                  <Upload className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {file ? file.name : 'Dosya seçin veya buraya sürükleyin'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  CSV, XLS veya XLSX formatında
                </p>
                {file && (
                  <div className="mt-4 flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Dosya hazır!</span>
                  </div>
                )}
              </label>
            </div>

            {/* Process Button */}
            {file && (
              <div className="mt-6">
                <button
                  onClick={handleProcess}
                  disabled={importing}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      İşleniyor...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Eşleştirmeleri Bul
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                📋 Nasıl Çalışır?
              </h4>
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Banka ekstrenizi CSV veya Excel formatında hazırlayın</li>
                <li>Dosyayı yükleyin ve eşleştirme işlemini başlatın</li>
                <li>Sistem otomatik olarak ref kodlarını eşleştirecek</li>
                <li>Eşleşen işlemleri toplu olarak onaylayın</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Match Results */}
      {matchResults && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h3 className="font-semibold text-green-900">Eşleşti</h3>
              </div>
              <p className="text-3xl font-bold text-green-700">
                {matchResults.filter(m => m.status === 'matched').length}
              </p>
              <p className="text-sm text-green-600 mt-1">işlem</p>
            </div>

            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                <h3 className="font-semibold text-orange-900">Eşleşmedi</h3>
              </div>
              <p className="text-3xl font-bold text-orange-700">
                {matchResults.filter(m => m.status === 'unmatched').length}
              </p>
              <p className="text-sm text-orange-600 mt-1">işlem</p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-6 h-6 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Seçili</h3>
              </div>
              <p className="text-3xl font-bold text-blue-700">
                {selectedMatches.length}
              </p>
              <p className="text-sm text-blue-600 mt-1">işlem</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={selectAllMatched}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Tümünü Seç
            </button>
            <button
              onClick={() => setSelectedMatches([])}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Seçimi Temizle
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={selectedMatches.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
            >
              <CheckCircle2 className="w-5 h-5" />
              Seçilenleri Onayla ({selectedMatches.length})
            </button>
            <button
              onClick={() => {
                setMatchResults(null);
                setFile(null);
                setSelectedMatches([]);
              }}
              className="ml-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Yeni İçe Aktarma
            </button>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllMatched();
                          } else {
                            setSelectedMatches([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ekstre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Eşleşen İşlem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Güven
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matchResults.map((match) => (
                    <tr
                      key={match.id}
                      className={`hover:bg-gray-50 transition ${
                        selectedMatches.includes(match.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedMatches.includes(match.id)}
                          onChange={() => toggleSelection(match.id)}
                          disabled={match.status !== 'matched'}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {match.status === 'matched' ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-semibold text-sm">Eşleşti</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-600">
                            <XCircle className="w-5 h-5" />
                            <span className="font-semibold text-sm">Eşleşmedi</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-mono font-semibold text-sm">
                            {match.statementData.description}
                          </p>
                          <p className="text-sm text-gray-600">
                            {match.statementData.amount.toLocaleString()} ₺
                          </p>
                          <p className="text-xs text-gray-500">
                            {match.statementData.sender}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {match.matchedTransaction ? (
                          <div>
                            <p className="font-mono font-semibold text-sm text-blue-600">
                              {match.matchedTransaction.refCode}
                            </p>
                            <p className="text-sm text-gray-600">
                              {match.matchedTransaction.amount.toLocaleString()} ₺
                            </p>
                            <p className="text-xs text-gray-500">
                              {match.matchedTransaction.customerName}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            Eşleşme bulunamadı
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {match.matchConfidence > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    match.matchConfidence >= 90
                                      ? 'bg-green-500'
                                      : match.matchConfidence >= 70
                                      ? 'bg-yellow-500'
                                      : 'bg-orange-500'
                                  }`}
                                  style={{ width: `${match.matchConfidence}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700">
                                {match.matchConfidence.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
