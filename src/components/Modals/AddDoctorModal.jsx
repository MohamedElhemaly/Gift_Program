import React, { useState, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { UserPlus, X, MapPin, Building2, Navigation, Phone, Smartphone, Stethoscope, Hash, Activity } from 'lucide-react';

export default function AddDoctorModal() {
  const {
    isAddDoctorModalOpen,
    closeAddDoctorModal,
    addDoctorInitialData,
    addDoctor,
    locations,
    displayedDoctors,
  } = useDoctorStore();

  const [formData, setFormData] = useState({
    doc_code: '',
    name: '',
    specialty: '',
    pageGvr: '',
    pageCity: '',
    pageRegion: '',
    address: '',
    mobile: '',
    home_tel: '',
    old_stats: '',
    new_stats: '',
  });

  const [loading, setLoading] = useState(false);

  // Auto-fill or suggest code when opened
  useEffect(() => {
    if (isAddDoctorModalOpen) {
      // Find highest numeric code to suggest next code
      let maxCode = 1000;
      displayedDoctors.forEach((d) => {
        const num = parseInt(d.doc_code, 10);
        if (!isNaN(num) && num > maxCode) maxCode = num;
      });

      setFormData({
        doc_code: String(maxCode + 1),
        name: '',
        specialty: '',
        pageGvr: addDoctorInitialData?.pageGvr || '',
        pageCity: addDoctorInitialData?.pageCity || '',
        pageRegion: addDoctorInitialData?.pageRegion || '',
        address: '',
        mobile: '',
        home_tel: '',
        old_stats: '0',
        new_stats: '0',
      });
    }
  }, [isAddDoctorModalOpen, addDoctorInitialData, displayedDoctors]);

  if (!isAddDoctorModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('برجاء كتابة اسم الطبيب!');
      return;
    }
    if (!formData.doc_code.trim()) {
      alert('برجاء إدخال كود الطبيب!');
      return;
    }

    setLoading(true);
    let doctorName = formData.name.trim();
    if (!doctorName.includes('أ.د/')) {
      doctorName = 'أ.د/ ' + doctorName;
    }

    await addDoctor({
      ...formData,
      name: doctorName,
      doc_code: formData.doc_code.trim(),
    });

    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={closeAddDoctorModal}>
      <div
        className="modal-content w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-right max-h-[90vh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">إضافة طبيب جديد إلى التقرير</h2>
              <p className="text-xs text-slate-500">
                أدخل بيانات الطبيب لحفظها مباشرة في قاعدة البيانات وتحديث شبكة الطباعة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAddDoctorModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Doctor Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-blue-500" />
                <span>كود الطبيب *</span>
              </label>
              <input
                type="text"
                required
                value={formData.doc_code}
                onChange={(e) => setFormData({ ...formData, doc_code: e.target.value })}
                placeholder="مثال: 54225"
                className="w-full text-xs p-2.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Doctor Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                <span>اسم الطبيب *</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: احمد محمد علي"
                className="w-full text-xs p-2.5 font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Specialty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التخصص</label>
              <input
                type="text"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="مثال: باطنة، جراحة، أطفال..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">عنوان العيادة</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="مثال: 15 شارع الجمهورية برج الأطباء"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Location Fields */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>موقع الطباعة (المحافظة والمدينة والمنطقة)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">المحافظة</label>
                <input
                  type="text"
                  value={formData.pageGvr}
                  onChange={(e) => setFormData({ ...formData, pageGvr: e.target.value })}
                  placeholder="مثال: البحيرة"
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">المدينة / المركز</label>
                <input
                  type="text"
                  value={formData.pageCity}
                  onChange={(e) => setFormData({ ...formData, pageCity: e.target.value })}
                  placeholder="مثال: دمنهور"
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">المنطقة</label>
                <input
                  type="text"
                  value={formData.pageRegion}
                  onChange={(e) => setFormData({ ...formData, pageRegion: e.target.value })}
                  placeholder="مثال: شارع السنترال"
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Contact Numbers & Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                <span>رقم الموبايل</span>
              </label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="مثال: 01012345678"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-blue-500" />
                <span>تليفون أرضي</span>
              </label>
              <input
                type="text"
                value={formData.home_tel}
                onChange={(e) => setFormData({ ...formData, home_tel: e.target.value })}
                placeholder="مثال: 0453310000"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                <span>حالات قديم</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.old_stats}
                onChange={(e) => setFormData({ ...formData, old_stats: e.target.value })}
                className="w-full text-xs p-2.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span>حالات جديد</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.new_stats}
                onChange={(e) => setFormData({ ...formData, new_stats: e.target.value })}
                className="w-full text-xs p-2.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={closeAddDoctorModal}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'جاري الحفظ...' : 'حفظ الطبيب وإضافته'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
