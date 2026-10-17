import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { doctorService } from '../services/doctorService';
import { useDoctorStore } from '../store/useDoctorStore';

export const QUERY_KEYS = {
  DOCTORS: ['doctors'],
  LOCATIONS: ['locations'],
};

/**
 * Hook to fetch all doctors with instant localStorage initialData cache
 */
export function useDoctorsData() {
  const { setRawDoctorsAndRebuild, setAutoSaveState } = useDoctorStore();

  return useQuery({
    queryKey: QUERY_KEYS.DOCTORS,
    queryFn: async () => {
      const data = await doctorService.fetchDoctors();
      setRawDoctorsAndRebuild(data);
      setAutoSaveState('saved');
      return data;
    },
    initialData: () => {
      try {
        const cached = localStorage.getItem('gift_program_doctors_data');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTimeout(() => {
              if (useDoctorStore.getState().rawDoctors.length === 0) {
                setRawDoctorsAndRebuild(parsed);
              }
            }, 0);
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Initial cache read error:', e);
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch unique locations
 */
export function useLocationsData() {
  const { setLocations } = useDoctorStore();

  return useQuery({
    queryKey: QUERY_KEYS.LOCATIONS,
    queryFn: async () => {
      const locs = await doctorService.fetchLocations();
      setLocations(locs);
      return locs;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Optimistic mutation for inline editing
 */
export function useUpdateDoctorFieldMutation() {
  const queryClient = useQueryClient();
  const { setAutoSaveState, rawDoctors, setRawDoctorsAndRebuild } = useDoctorStore();

  return useMutation({
    mutationFn: async ({ id, docCode, field, value }) => {
      return await doctorService.updateDoctorField(id, docCode, field, value);
    },
    onMutate: async ({ id, docCode, field, value }) => {
      setAutoSaveState('saving');
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.DOCTORS });

      const previousDoctors = queryClient.getQueryData(QUERY_KEYS.DOCTORS) || rawDoctors;

      // Optimistically update React Query cache
      const updatedDoctors = previousDoctors.map((doc) => {
        if ((id && doc.id === id) || (docCode && String(doc.doc_code).trim() === String(docCode).trim())) {
          return {
            ...doc,
            [field]: value,
            [field + '_modified']: true,
            [field + '_updated']: false,
            is_modified: true,
          };
        }
        return doc;
      });

      queryClient.setQueryData(QUERY_KEYS.DOCTORS, updatedDoctors);

      return { previousDoctors };
    },
    onError: (err, variables, context) => {
      setAutoSaveState('error');
      if (context?.previousDoctors) {
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, context.previousDoctors);
        setRawDoctorsAndRebuild(context.previousDoctors);
      }
      toast.error(`فشل حفظ التعديل: ${err.message || 'خطأ في الاتصال'}`);
    },
    onSuccess: () => {
      setAutoSaveState('saved');
    },
  });
}

/**
 * Optimistic mutation for moving doctor
 */
export function useMoveDoctorMutation() {
  const queryClient = useQueryClient();
  const { setAutoSaveState, rawDoctors, setRawDoctorsAndRebuild } = useDoctorStore();

  return useMutation({
    mutationFn: async ({ doctor, newGvr, newCity, newRegion }) => {
      return await doctorService.moveDoctor(doctor, newGvr, newCity, newRegion);
    },
    onMutate: async ({ doctor, newGvr, newCity, newRegion }) => {
      setAutoSaveState('saving');
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.DOCTORS });

      const previousDoctors = queryClient.getQueryData(QUERY_KEYS.DOCTORS) || rawDoctors;
      const oldLocStr = `${doctor.pageGvr || ''} - ${doctor.pageCity || ''} - ${doctor.pageRegion || ''}`;

      const updatedDoctors = previousDoctors.map((d) => {
        if ((doctor.id && d.id === doctor.id) || (doctor.doc_code && String(d.doc_code).trim() === String(doctor.doc_code).trim())) {
          return {
            ...d,
            pageGvr: newGvr,
            pageCity: newCity,
            pageRegion: newRegion,
            is_moved: true,
            moved_from: oldLocStr,
            pageGvr_modified: true,
            pageCity_modified: true,
            pageRegion_modified: true,
            is_modified: true,
          };
        }
        return d;
      });

      queryClient.setQueryData(QUERY_KEYS.DOCTORS, updatedDoctors);
      setRawDoctorsAndRebuild(updatedDoctors);

      return { previousDoctors };
    },
    onError: (err, variables, context) => {
      setAutoSaveState('error');
      if (context?.previousDoctors) {
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, context.previousDoctors);
        setRawDoctorsAndRebuild(context.previousDoctors);
      }
      toast.error(`فشل نقل الطبيب: ${err.message || 'خطأ في الخادم'}`);
    },
    onSuccess: (_, variables) => {
      setAutoSaveState('saved');
      toast.success(`تم نقل الطبيب بنجاح إلى: ${variables.newGvr} - ${variables.newCity} - ${variables.newRegion}`);
    },
  });
}

/**
 * Optimistic mutation for combining doctors
 */
export function useCombineDoctorsMutation() {
  const queryClient = useQueryClient();
  const { setAutoSaveState, rawDoctors, setRawDoctorsAndRebuild } = useDoctorStore();

  return useMutation({
    mutationFn: async ({ targetCode, sourceCode }) => {
      return await doctorService.combineDoctors(targetCode, sourceCode);
    },
    onMutate: async ({ targetCode, sourceCode }) => {
      setAutoSaveState('saving');
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.DOCTORS });

      const previousDoctors = queryClient.getQueryData(QUERY_KEYS.DOCTORS) || rawDoctors;
      const cleanTarget = String(targetCode).trim();
      const cleanSource = String(sourceCode).trim();

      const sourceDoc = previousDoctors.find((d) => String(d.doc_code).trim() === cleanSource);
      if (!sourceDoc) {
        throw new Error('لم يتم العثور على الطبيب المراد دمجه');
      }

      const updatedDoctors = previousDoctors.map((d) => {
        const curCode = String(d.doc_code).trim();
        if (curCode === cleanTarget) {
          const oldStats = (parseInt(d.old_stats, 10) || 0) + (parseInt(sourceDoc.old_stats, 10) || 0);
          const newStats = (parseInt(d.new_stats, 10) || 0) + (parseInt(sourceDoc.new_stats, 10) || 0);
          const merged = [...(d.merged_codes || [])];
          if (!merged.includes(cleanSource)) merged.push(cleanSource);
          if (sourceDoc.merged_codes) merged.push(...sourceDoc.merged_codes);

          return {
            ...d,
            old_stats: oldStats,
            new_stats: newStats,
            merged_codes: merged,
            old_stats_modified: true,
            new_stats_modified: true,
            is_modified: true,
          };
        } else if (curCode === cleanSource) {
          return {
            ...d,
            name: '',
            specialty: '',
            address: '',
            mobile: '',
            home_tel: '',
            old_stats: '',
            new_stats: '',
            is_inactive: false,
            is_moved: false,
            moved_from: '',
            merged_codes: [],
          };
        }
        return d;
      });

      queryClient.setQueryData(QUERY_KEYS.DOCTORS, updatedDoctors);
      setRawDoctorsAndRebuild(updatedDoctors);

      return { previousDoctors };
    },
    onError: (err, variables, context) => {
      setAutoSaveState('error');
      if (context?.previousDoctors) {
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, context.previousDoctors);
        setRawDoctorsAndRebuild(context.previousDoctors);
      }
      toast.error(`فشل الدمج: ${err.message || 'خطأ في الخادم'}`);
    },
    onSuccess: (_, variables) => {
      setAutoSaveState('saved');
      toast.success(`تم دمج الطبيب (${variables.sourceCode}) مع (${variables.targetCode}) بنجاح`);
    },
  });
}

/**
 * Optimistic mutation for toggling inactive
 */
export function useToggleInactiveMutation() {
  const queryClient = useQueryClient();
  const { setAutoSaveState, rawDoctors, setRawDoctorsAndRebuild } = useDoctorStore();

  return useMutation({
    mutationFn: async (variables) => {
      const doc = variables?.doctor || variables;
      const targetState =
        variables?.targetState !== undefined
          ? Boolean(variables.targetState)
          : !Boolean(doc.is_inactive);

      return await doctorService.setDoctorInactiveState(doc, targetState);
    },
    onMutate: async (variables) => {
      setAutoSaveState('saving');
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.DOCTORS });

      const doc = variables?.doctor || variables;
      const targetState =
        variables?.targetState !== undefined
          ? Boolean(variables.targetState)
          : !Boolean(doc.is_inactive);

      const previousDoctors = queryClient.getQueryData(QUERY_KEYS.DOCTORS) || rawDoctors;

      const updatedDoctors = previousDoctors.map((d) => {
        if (
          (doc.id && d.id === doc.id) ||
          (doc.doc_code && String(d.doc_code).trim() === String(doc.doc_code).trim())
        ) {
          return { ...d, is_inactive: targetState };
        }
        return d;
      });

      queryClient.setQueryData(QUERY_KEYS.DOCTORS, updatedDoctors);
      setRawDoctorsAndRebuild(updatedDoctors);

      return { previousDoctors, targetState, doctor: doc };
    },
    onError: (err, variables, context) => {
      setAutoSaveState('error');
      if (context?.previousDoctors) {
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, context.previousDoctors);
        setRawDoctorsAndRebuild(context.previousDoctors);
      }
      toast.error(`فشل تغيير الحالة: ${err.message || 'خطأ'}`);
    },
    onSuccess: (_, variables, context) => {
      setAutoSaveState('saved');
      const doc = variables?.doctor || variables;
      const targetState =
        context?.targetState !== undefined
          ? context.targetState
          : Boolean(variables?.targetState);
      const docName = doc.name || doc.doc_code || 'الطبيب';

      if (targetState) {
        toast.success(`تم إيقاف ${docName} بنجاح (معطل)`);
      } else {
        toast.success(`تم إعادة تفعيل ${docName} بنجاح`);
      }
    },
  });
}

/**
 * Optimistic mutation for adding a doctor
 */
export function useAddDoctorMutation() {
  const queryClient = useQueryClient();
  const { setAutoSaveState, rawDoctors, setRawDoctorsAndRebuild } = useDoctorStore();

  return useMutation({
    mutationFn: async (doctorData) => {
      return await doctorService.addDoctor(doctorData);
    },
    onMutate: async (doctorData) => {
      setAutoSaveState('saving');
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.DOCTORS });

      const previousDoctors = queryClient.getQueryData(QUERY_KEYS.DOCTORS) || rawDoctors;
      const tempId = 'temp-' + crypto.randomUUID();
      const optimisticDoc = {
        ...doctorData,
        id: tempId,
        isNew: true,
        is_new: true,
        isModified: true,
        is_modified: true,
        name_modified: true,
        doc_code_modified: true,
        is_moved: false,
        is_inactive: false,
        merged_codes: [],
      };

      const updatedDoctors = [...previousDoctors, optimisticDoc];
      queryClient.setQueryData(QUERY_KEYS.DOCTORS, updatedDoctors);
      setRawDoctorsAndRebuild(updatedDoctors);

      return { previousDoctors };
    },
    onError: (err, variables, context) => {
      setAutoSaveState('error');
      if (context?.previousDoctors) {
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, context.previousDoctors);
        setRawDoctorsAndRebuild(context.previousDoctors);
      }
      toast.error(`فشل إضافة الطبيب: ${err.message || 'خطأ'}`);
    },
    onSuccess: (data) => {
      setAutoSaveState('saved');
      toast.success(`تمت إضافة الطبيب بنجاح!`);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DOCTORS });
    },
  });
}

/**
 * Optimistic mutation for deleting a doctor
 */
export function useDeleteDoctorMutation() {
  const queryClient = useQueryClient();
  const { setAutoSaveState, rawDoctors, setRawDoctorsAndRebuild } = useDoctorStore();

  return useMutation({
    mutationFn: async (doctor) => {
      return await doctorService.deleteDoctor(doctor);
    },
    onMutate: async (doctor) => {
      setAutoSaveState('saving');
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.DOCTORS });

      const previousDoctors = queryClient.getQueryData(QUERY_KEYS.DOCTORS) || rawDoctors;
      const updatedDoctors = previousDoctors.filter((d) => {
        if (doctor.id && d.id) return d.id !== doctor.id;
        if (doctor.doc_code && d.doc_code) return String(d.doc_code).trim() !== String(doctor.doc_code).trim();
        return true;
      });

      queryClient.setQueryData(QUERY_KEYS.DOCTORS, updatedDoctors);
      setRawDoctorsAndRebuild(updatedDoctors);

      return { previousDoctors };
    },
    onError: (err, variables, context) => {
      setAutoSaveState('error');
      if (context?.previousDoctors) {
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, context.previousDoctors);
        setRawDoctorsAndRebuild(context.previousDoctors);
      }
      toast.error(`فشل حذف الطبيب: ${err.message || 'خطأ'}`);
    },
    onSuccess: (_, doctor) => {
      setAutoSaveState('saved');
      toast.success(`تم حذف الطبيب "${doctor.name || doctor.doc_code}" بنجاح`);
    },
  });
}
