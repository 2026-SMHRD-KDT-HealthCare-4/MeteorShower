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
          '피네(FINE)는 재활치료 이동을 AI 기술로 보조하는 서비스입니다.\n' +
          '카메라를 통해 손동작을 인식하고, 이동 수행 결과를 분석하여 담당 의사에게 전달합니다.',
      },
      {
        heading: 'AI 보조 도구 안내',
        body:
          '본 서비스의 AI 기능(소견 이견 작성, 처방 조정 제안)은 의료기기가 아닌 보조 도구입니다.\n' +
          'AI가 생성한 모든 정보는 담당 주치의의 검토 및 승인을 거친 후 환자에게 전달됩니다.\n' +
          '최종 의료 판단은 담당 의사가 내리며, AI 결과만으로 치료 방침을 결정하지 않습니다.',
      },
      {
        heading: '이용자 의무',
        body:
          '서비스를 의료 전문가의 지도 없이 자가 진단·치료 목적으로 사용하지 않습니다.\n' +
          '이동 중 통증이나 이상 증상이 발생하면 즉시 이동을 중단하고 담당 의사에게 알립니다.\n' +
          '타인의 계정을 사용하거나 본인의 계정을 타인에게 제공하지 않습니다.',
      },
      {
        heading: '면책 조항',
        body:
          '본 서비스는 의사의 대면 진료를 대체하지 않습니다.\n' +
          'AI 분석 결과와 실제 임상적 상태 사이에 차이가 있을 수 있으며, 이로 인한 의료적 결정은 담당 의사의 책임 하에 이루어집니다.\n' +
          '네트워크 장애, 기기 호환성 등 기술적 문제로 인한 서비스 중단에 대해 별도 보상하지 않습니다.',
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
        heading: '1. 기본 개인정보',
        body:
          '수집 항목: 이름, 생년월일, 성별, 전화번호, 아이디, 비밀번호(암호화 저장)\n' +
          '수집 목적: 환자 식별 및 인증, 서비스 제공\n' +
          '보존 기간: 회원 탈퇴 시까지 (탈퇴 후 30일 이내 파기)',
      },
      {
        heading: '2. 건강정보 (민감정보)',
        body:
          '수집 항목: 수술명, 수술 부위, 수술일, 재활 시작일, 재활 단계, 관절 가동범위(ROM), 손가락별 수행도, 이동 수행 기록, 과부하 기록, 재진 문진 결과\n' +
          '수집 목적: 맞춤형 재활 이동 제공, 재활 경과 분석, AI 소견 이견 작성\n' +
          '보존 기간: 회원 탈퇴 시까지\n' +
          '법적 근거: 개인정보보호법 제23조 (민감정보 처리 – 별도 동의)',
      },
      {
        heading: '3. 카메라 영상 및 전이미지',
        body:
          '수집 항목: 실시간 카메라 영상(전신역), 과부하 시 캡처 이미지\n' +
          '수집 목적: 실시간 손동작 인식 및 이동 수행도 분석\n' +
          '처리 방식: 분석용 실시간 분석 후 저장하지 않으며, 캡처 이미지는 24시간 이내 삭제',
      },
      {
        heading: '4. 음성 데이터',
        body:
          '수집 항목: AI 챗봇 이용 시 음성 비트, 음성→텍스트 변환 결과\n' +
          '수집 목적: AI 챗봇을 통한 재활 상담 제공\n' +
          '처리 방식: 원본 음성은 텍스트 변환 즉시 파기, 변환 텍스트는 세션 종료 시 삭제',
      },
      {
        heading: '5. 개인정보 제3자 제공',
        body:
          '제공받는 자: OpenAI, Inc. (미국)\n' +
          '제공 항목: 재활 이동 데이터, 관절 가동범위, 이동 수행도, 문진 결과, 음성 변환 텍스트\n' +
          '제공 목적: AI 소견 이견 작성, 처방 조정 제안작성, 음성 인식\n' +
          '보존 기간: 처리 즉시 파기 (모델 학습에 사용되지 않음)\n' +
          '법적 근거: 개인정보보호법 제17조, 제28조8 (국외 이전)',
      },
      {
        heading: '안내',
        body:
          '동의는 마이페이지에서 언제든 철회할 수 있으며, 철회 시 관련 기능 이용이 제한됩니다.\n' +
          '수집된 정보에 대한 이동·수정·삭제 요청은 설정 메뉴를 통해 가능합니다.',
      },
    ],
  },
  {
    key: 'guardian',
    required: false,
    label: '보호자 이메일로 재활 보고서 수신 전송에 동의합니다',
    tag: '선택',
    sections: [
      {
        heading: '보호자 리포트 전송',
        body:
          '전송 항목: 주간·월간 재활 경과 보고서 (이동 달성률, AI 종합 의견, 주치의 코멘트)\n' +
          '전송 대상: 환자가입 시 입력한 보호자 이메일\n' +
          '전송 목적: 보호자의 재활 경과 모니터링 지원\n' +
          '동의하지 않으면 보호자에게 보고서가 전송되지 않으며, 본인과 주치의만 이동 가능합니다.\n' +
          '마이페이지에서 언제든 동의를 철회할 수 있습니다.',
      },
    ],
  },
];

export default function PatientConsent({ onChange, submitAttempted = false }) {
  const [agreed, setAgreed] = useState({});
  const [expanded, setExpanded] = useState({});

  const requiredKeys = CONSENT_ITEMS.filter((c) => c.required).map((c) => c.key);
  const allRequiredChecked = requiredKeys.every((k) => agreed[k]);
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
          피네는 건강정보와 AI 기술을 활용하는 재활 서비스입니다.
          각 항목의 <strong className="text-on-surface">세부 내용을 확인</strong>하신 후 동의해주세요.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer bg-primary-container/10 border-2 border-primary-container rounded-xl px-4 py-3.5 transition-colors hover:bg-primary-container/20">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          className="w-5 h-5 rounded accent-primary-container shrink-0"
        />
        <span className="text-body-md font-semibold text-on-surface">전체 동의</span>
      </label>

      <div className="space-y-3">
        {CONSENT_ITEMS.map((item) => {
          const isOpen = !!expanded[item.key];
          const showError = submitAttempted && item.required && !agreed[item.key];

          return (
            <div
              key={item.key}
              className={`bg-surface-container-lowest rounded-xl border transition-colors ${
                showError
                  ? 'border-red-400'
                  : agreed[item.key]
                  ? 'border-primary-container/40'
                  : 'border-surface-variant/50'
              }`}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={!!agreed[item.key]}
                  onChange={() => setAgreed((p) => ({ ...p, [item.key]: !p[item.key] }))}
                  className="w-5 h-5 rounded accent-primary-container mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-label-md text-on-surface-variant">{item.label}</span>
                  <span className={`ml-2 text-label-sm font-semibold ${item.required ? 'text-primary-container' : 'text-outline'}`}>
                    ({item.tag})
                  </span>
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

      {submitAttempted && !allRequiredChecked && (
        <p className="text-label-sm text-red-500 text-center">필수 항목을 모두 동의해주세요.</p>
      )}
    </div>
  );
}
