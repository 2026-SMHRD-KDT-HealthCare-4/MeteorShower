import { useState, useEffect } from 'react';

const CONSENT_ITEMS = [
  {
    key: 'terms',
    required: true,
    label: '서비스 이용약관에 동의합니다',
    tag: '필수',
    sections: [
      {
        heading: '서비스 개요',
        body:
          '피네(FINE)는 재활치료 환자의 이동 및 운동 데이터를 AI로 분석하여 담당 의사의 의료 판단을 보조하는 서비스입니다.\n' +
          '환자의 관절 가동범위(ROM), 이동 수행도, 과부하 기록 등을 수집·분석하여 의사에게 제공합니다.',
      },
      {
        heading: 'AI 보조 도구의 성격 및 의사의 책임',
        body:
          '본 서비스의 AI 기능은 의료기기로 허가받지 않은 보조 도구입니다.\n' +
          'AI가 생성하는 소견 이견과 처방 조정 제안은 참고자료이며, 최종 의료 판단과 처방 결정은 전적으로 담당 의사의 책임입니다.\n' +
          'AI 소견은 반드시 검토·수정 후 환자에게 전달해야 하며, 미검토 상태로 전달되지 않습니다.\n' +
          '처방 조정 제안(인트 ±1, 횟수 ±5)은 의사가 승인하기 전까지 환자에게 적용되지 않습니다.',
      },
      {
        heading: '환자 데이터 관리 의무',
        body:
          '담당 환자의 개인정보 및 건강정보를 서비스 목적 외로 활용하지 않습니다.\n' +
          '환자의 재활 데이터를 무단으로 외부에 공유하지 않습니다.\n' +
          '퇴직, 이직 등으로 환자 관계가 종료되면 환자 연결 해제를 요청합니다.',
      },
      {
        heading: '면책 조항',
        body:
          'AI 분석 결과와 실제 환자 임상 사이에 차이가 있을 수 있으며, AI 결과에 의존한 판단으로 발생하는 의료적 결과에 대해 서비스 제공자는 책임지지 않습니다.\n' +
          '네트워크 장애 등 기술적 문제로 인한 서비스 중단에 대해 별도 보상하지 않습니다.',
      },
    ],
  },
  {
    key: 'privacy',
    required: true,
    label: '개인정보 수집·이용에 동의합니다',
    tag: '필수',
    sections: [
      {
        heading: '수집 항목',
        body:
          '이름, 전화번호, 이메일, 아이디, 비밀번호(암호화 저장), 소속병원명, 의사 면허번호',
      },
      {
        heading: '수집 목적',
        body:
          '의사 식별 및 인증, 담당 환자 매칭, 의사 자격 확인, 서비스 내 진료 지원 기능 제공',
      },
      {
        heading: '보존 기간',
        body:
          '회원 탈퇴 시까지 (탈퇴 후 30일 이내 파기)\n' +
          '단, 의료법상 진료기록 보존 의무가 적용되는 데이터는 관련 법령에 따라 보존될 수 있습니다.',
      },
      {
        heading: '안내',
        body:
          '동의를 거부할 수 있으나, 거부 시 서비스 이용이 불가합니다.\n' +
          '수집된 정보에 대한 이동·수정·삭제 요청은 설정 메뉴를 통해 가능합니다.\n' +
          '법적 근거: 개인정보보호법 제15조 제1항 제1호 (정보주체의 동의)',
      },
    ],
  },
];

export default function DoctorConsent({ onChange, submitAttempted = false }) {
  const [agreed, setAgreed] = useState({});
  const [expanded, setExpanded] = useState({});

  const allChecked = CONSENT_ITEMS.every((c) => agreed[c.key]);

  useEffect(() => {
    if (onChange) onChange(agreed);
  }, [agreed]);

  const toggleAll = () => {
    if (allChecked) {
      setAgreed({});
    } else {
      const next = {};
      CONSENT_ITEMS.forEach((c) => (next[c.key] = true));
      setAgreed(next);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-body-md text-on-surface-variant leading-relaxed">
          피네는 AI가 생성한 소견·처방 조정안을
          <strong className="text-on-surface"> 의사가 검토·승인</strong>하는 구조의 서비스입니다.
          이용약관의 AI 관련 조항을 반드시 확인해주세요.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer bg-[#005bbf]/5 border-2 border-[#005bbf]/30 rounded-xl px-4 py-3.5 transition-colors hover:bg-[#005bbf]/10">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          className="w-5 h-5 rounded accent-[#005bbf] shrink-0"
        />
        <span className="text-body-md font-semibold text-on-surface">전체 동의</span>
      </label>

      <div className="space-y-3">
        {CONSENT_ITEMS.map((item) => {
          const isOpen = !!expanded[item.key];
          const showError = submitAttempted && !agreed[item.key];

          return (
            <div
              key={item.key}
              className={`bg-surface-container-lowest rounded-xl border transition-colors ${
                showError
                  ? 'border-red-400'
                  : agreed[item.key]
                  ? 'border-[#005bbf]/30'
                  : 'border-surface-variant/50'
              }`}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={!!agreed[item.key]}
                  onChange={() => setAgreed((p) => ({ ...p, [item.key]: !p[item.key] }))}
                  className="w-5 h-5 rounded accent-[#005bbf] mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-label-md text-on-surface-variant">{item.label}</span>
                  <span className="ml-2 text-label-sm font-semibold text-[#005bbf]">({item.tag})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [item.key]: !p[item.key] }))}
                  className="text-outline hover:text-on-surface transition-colors shrink-0 mt-0.5"
                >
                  <span
                    className="material-symbols-outlined text-xl transition-transform"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    expand_more
                  </span>
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-surface-variant/30 mx-4 pb-4">
                  {item.sections.map((sec, i) => (
                    <div key={i} className="mt-3">
                      <p className="text-label-md font-semibold text-on-surface mb-1">{sec.heading}</p>
                      <p className="text-label-md text-on-surface-variant whitespace-pre-line leading-relaxed">{sec.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {showError && (
                <p className="text-label-sm text-red-500 px-4 pb-3 -mt-1">필수 동의 항목입니다.</p>
              )}
            </div>
          );
        })}
      </div>

      {submitAttempted && !allChecked && (
        <p className="text-label-sm text-red-500 text-center">모든 항목에 동의해주세요.</p>
      )}
    </div>
  );
}
