import { useState } from 'react';

const QUESTIONS = [
  '주먹을 쥐었다 필 때 공간이 있나요? (예시)',
  '손가락을 구부릴 때 걸리는 느낌이 있나요? (예시)',
];

export default function NextExamModal({ onConfirm, onClose, onBlocked }) {
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const allAnswered = answers.every((a) => a !== null);

  const handleConfirm = () => {
    setSubmitted(true);
    if (!allAnswered) return;
    if (answers.some((a) => a === 'yes')) {
      setBlocked(true);
      onBlocked?.();
    } else {
      onConfirm();
    }
  };

  const setAnswer = (idx, val) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!blocked ? onClose : undefined}
      />
      <div className="relative bg-[#0c1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">

        {!blocked ? (
          <>
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined text-teal-400 text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                health_and_safety
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">다음 운동 전 확인</h2>
                <p className="text-sm text-gray-400">계속 진행하기 전에 현재 상태를 확인해주세요</p>
              </div>
            </div>

            <div className="space-y-4">
              {QUESTIONS.map((q, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
                  <p className="text-sm text-white font-medium">
                    <span className="text-teal-400 font-bold mr-1">Q{idx + 1}.</span>{q}
                  </p>
                  <div className="flex gap-3">
                    {[{ val: 'yes', label: '예' }, { val: 'no', label: '아니오' }].map(({ val, label }) => {
                      const selected = answers[idx] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setAnswer(idx, val)}
                          className={`flex-1 h-10 rounded-lg text-sm font-semibold border-2 transition-all
                            ${selected
                              ? val === 'yes'
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'bg-teal-500 border-teal-500 text-white'
                              : 'border-white/20 text-gray-400 hover:border-white/40'
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {submitted && !allAnswered && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">error</span>
                모든 항목에 답변해 주세요
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-white/20 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-11 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold active:scale-95 transition-all"
              >
                확인
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-red-400 text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_hospital
              </span>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">운동을 중단해 주세요</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                증상이 확인되어 추가 운동을 권장하지 않습니다.<br />
                빠른 시일 내에 병원을 방문하여<br />
                주치의와 상담하시기 바랍니다.
              </p>
            </div>
            <div className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-400 font-semibold flex items-center justify-center gap-1.5">
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
                무리한 운동은 증상을 악화시킬 수 있습니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-all"
            >
              운동 목록으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
