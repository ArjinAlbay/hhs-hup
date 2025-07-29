'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMeetingsApi, useClubsApi } from '@/hooks/useSimpleApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface MeetingFormProps {
  clubId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function MeetingForm({ clubId, onSuccess, onCancel }: MeetingFormProps) {
  const { user } = useAuth();
  const { post, loading: isLoading } = useMeetingsApi();
  const { data: clubs = [] } = useClubsApi();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    club_id: clubId || '',
    startDate: '',
    startTime: '',
    end_time: '',
    location: ''
  });
  
  const [error, setError] = useState<string | null>(null);

  // Club selection for display only

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    try {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = formData.end_time ? new Date(`${formData.startDate}T${formData.end_time}`) : null;

      const meetingData = {
        title: formData.title,
        description: formData.description,
        club_id: formData.club_id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime?.toISOString(),
        location: formData.location || null
      };

      await post(meetingData);
      onSuccess?.();
    } catch {
      setError('Toplantı oluşturulurken hata oluştu');
    }
  };

  // Participants will be handled separately in the future

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Yeni Toplantı Oluştur</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Temel Bilgiler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Toplantı Başlığı</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Toplantı başlığını girin"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Açıklama</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Toplantı açıklaması (isteğe bağlı)"
                rows={3}
              />
            </div>

            {!clubId && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Kulüp</label>
                <Select
                  value={formData.club_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, club_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kulüp seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((club) => (
                      <SelectItem key={club.id} value={club.id}>
                        {club.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Tarih ve Saat */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <Calendar className="inline mr-1 h-4 w-4" />
                Tarih
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Clock className="inline mr-1 h-4 w-4" />
                Saat
              </label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Clock className="inline mr-1 h-4 w-4" />
                Bitiş Saati (isteğe bağlı)
              </label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          {/* Lokasyon */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <MapPin className="inline mr-1 h-4 w-4" />
              Konum (isteğe bağlı)
            </label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Toplantı odası, adres vb."
            />
          </div>

          {/* Participants will be added in a future update */}

          {/* Form Butonları */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                İptal
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Oluşturuluyor...' : 'Toplantı Oluştur'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}