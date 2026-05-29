            {/* ═══ HORÁRIOS ═══ */}
            {dashTab==='horarios'&&(()=>{
              const { year, month } = parseYearMonth(horarioYearMonth)
              const nowYM = currentYearMonthStr()
              const isPastMonth = horarioYearMonth < nowYM
              const totalDias = daysInMonth(year, month)

              // Um array por dia do mês com metadados
              const days = Array.from({ length: totalDias }, (_, i) => {
                const day = i + 1
                const dow = dayOfWeek(year, month, day)
                return { day, dow, isWeekend: dow >= 6, isLastOfWeek: dow === 7 || day === totalDias }
              })

              // Abreviatura compacta para a célula (1-2 caracteres)
              const compactLbl = (cell: CelulaDia|undefined): string => {
                if (!cell) return ''
                if (cell.tipo === 'trabalho') return cell.entrada ? cell.entrada.slice(0,2)+'h' : 'T'
                if (cell.tipo === 'folga') return 'F'
                if (cell.tipo === 'ferias') return 'V'
                if (cell.tipo === 'baixa') return 'B'
                if (cell.tipo === 'gozar-horas') return 'G'
                if (cell.tipo === 'outro-local') return 'OL'
                return ''
              }
              const cellTxtColor = (cell?: CelulaDia) =>
                cell?.tipo==='folga'?'#92400e':cell?.tipo==='ferias'?'#166534':cell?.tipo==='baixa'?'#9a3412':cell?.tipo==='gozar-horas'?'#075985':cell?.tipo==='outro-local'?'#5b21b6':theme.text

              const cellTitle = (cell: CelulaDia|undefined, day: number): string => {
                if (!cell) return `Dia ${day} — clique para preencher`
                const base = TIPO_DIA_LABELS[cell.tipo]
                return cell.entrada && cell.saida ? `${base} · ${cell.entrada}–${cell.saida}` : base
              }

              const DOW_CHAR = ['S','T','Q','Q','S','S','D']
              const navBtn: React.CSSProperties = { width:'32px', height:'32px', background:theme.card, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }

              return (
                <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                  {/* Barra de navegação */}
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'1rem', flexWrap:'wrap' }}>
                    <button onClick={prevMonth} style={navBtn}>‹</button>
                    <span style={{ fontWeight:700, fontSize:'16px', color:theme.text, minWidth:'160px', textAlign:'center' }}>{MONTH_NAMES[month-1]} {year}</span>
                    <button onClick={nextMonth} style={navBtn}>›</button>
                    <div style={{ flex:1 }}/>
                    <button onClick={exportarPDF} style={{ ...btnMd(theme.btn, theme.btnText) }}>📄 Exportar PDF</button>
                  </div>
                  {isPastMonth&&<div style={{ ...s.alertInfo, marginBottom:'1rem' }}>A visualizar mês passado. Os dados podem ser editados mas foram já processados.</div>}

                  {ativos.length===0
                    ? <div style={{ ...T.card2, padding:'3rem', textAlign:'center' }}><p style={{ fontSize:'40px' }}>📅</p><p style={{ color:theme.textMuted }}>Sem colaboradores ativos.</p></div>
                    : (
                      /* table-layout:fixed + width:100% → encaixa sempre sem overflow horizontal */
                      <div style={{ overflowY:'auto', flex:1 }}>
                        <table style={{ width:'100%', tableLayout:'fixed', borderCollapse:'collapse' }}>
                          <colgroup>
                            <col style={{ width:'13%' }}/>
                            {days.map(d => <col key={d.day}/>)}
                            <col style={{ width:'46px' }}/>
                          </colgroup>
                          <thead>
                            <tr style={{ background:theme.bg }}>
                              <th style={{ padding:'6px 8px', textAlign:'left', fontSize:'11px', fontWeight:700, color:theme.textMuted, border:'1px solid '+theme.border }}>
                                Colaborador
                              </th>
                              {days.map(d => (
                                <th key={d.day} style={{
                                  padding:'3px 1px', textAlign:'center', fontSize:'10px', fontWeight:700,
                                  color: d.isWeekend ? '#94a3b8' : theme.text,
                                  background: theme.bg,
                                  border:'1px solid '+theme.border,
                                  borderRight: d.isLastOfWeek ? '2px solid '+theme.border : '1px solid '+theme.border,
                                  userSelect:'none' as const
                                }}>
                                  <div style={{ fontSize:'8px', fontWeight:400, color:theme.textMuted, lineHeight:1.2 }}>{DOW_CHAR[d.dow-1]}</div>
                                  <div style={{ lineHeight:1.3 }}>{d.day}</div>
                                </th>
                              ))}
                              <th style={{ padding:'3px 2px', textAlign:'center', fontSize:'10px', fontWeight:700, background:'#dbeafe', color:'#1d4ed8', border:'1px solid '+theme.border }}>
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ativos.map((colab, ri) => {
                              const colabDays = horarioData[selectedCompany.email]?.[horarioYearMonth]?.[colab.id] ?? {}
                              const monthTotal = Object.values(colabDays).reduce((s, c) => s + calcMinutosTrabalhados(c), 0)
                              const rowBg = ri % 2 === 1 ? (theme.card === '#ffffff' ? '#fafafa' : theme.bg) : theme.card
                              return (
                                <tr key={colab.id}>
                                  <td title={colab.nome} style={{
                                    padding:'5px 8px', fontSize:'11px', fontWeight:600, color:theme.text,
                                    border:'1px solid '+theme.border, background:rowBg,
                                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'
                                  }}>{colab.nome}</td>
                                  {days.map(d => {
                                    const cell = colabDays[String(d.day)]
                                    const bg = cellBgColor(cell, d.isWeekend, rowBg, theme.bg)
                                    const lbl = compactLbl(cell)
                                    return (
                                      <td key={d.day}
                                        onClick={()=>openCellEdit(colab.id, d.day)}
                                        title={cellTitle(cell, d.day)}
                                        style={{
                                          background:bg, textAlign:'center',
                                          fontSize:'9px', fontWeight:700,
                                          border:'1px solid '+theme.border,
                                          borderRight: d.isLastOfWeek ? '2px solid '+theme.border : '1px solid '+theme.border,
                                          cursor:'pointer', height:'38px', verticalAlign:'middle',
                                          color:cellTxtColor(cell), lineHeight:1
                                        }}>
                                        {lbl}
                                      </td>
                                    )
                                  })}
                                  <td style={{
                                    textAlign:'center', fontSize:'10px', fontWeight:700,
                                    background:'#dbeafe', color:'#1d4ed8',
                                    border:'1px solid '+theme.border, cursor:'default'
                                  }}>
                                    {monthTotal>0?formatHoras(monthTotal):'—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  }

                  {/* Legenda */}
                  <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginTop:'10px', fontSize:'11px', color:theme.textMuted, alignItems:'center' }}>
                    {([['#fef9c3','Folga (F)'],['#dcfce7','Férias (V)'],['#fed7aa','Baixa (B)'],['#e0f2fe','Gozar Horas (G)'],['#ede9fe','Outro Local (OL)']] as [string,string][]).map(([bg,lbl])=>(
                      <div key={lbl} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                        <div style={{ width:'14px', height:'14px', borderRadius:'3px', background:bg, border:'1px solid #e2e8f0', flexShrink:0 }}/>
                        <span>{lbl}</span>
                      </div>
                    ))}
                    <span style={{ marginLeft:'4px' }}>· Linha dupla = fim de semana</span>
                  </div>

                  {/* Modal edição de célula */}
                  {editCelula&&(
                    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
                      <div style={{ background:theme.card, borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'380px', border:'1px solid '+theme.border }}>
                        <p style={{ fontWeight:700, fontSize:'15px', color:theme.text, marginTop:0, marginBottom:'4px' }}>
                          {ativos.find(c=>c.id===editCelula.colabId)?.nome}
                        </p>
                        <p style={{ fontSize:'12px', color:theme.textMuted, marginBottom:'1rem' }}>
                          Dia {editCelula.day} de {MONTH_NAMES[parseYearMonth(editCelula.yearMonth).month-1]} {parseYearMonth(editCelula.yearMonth).year}
                        </p>
                        <div style={{ marginBottom:'12px' }}>
                          <label style={T.label}>Tipo de dia</label>
                          <select style={T.select} value={editTipo} onChange={e=>{
                            const t = e.target.value as TipoDia
                            setEditTipo(t)
                            if (['folga','ferias','baixa'].includes(t)) { setEditEntrada(''); setEditSaida(''); setEditSemAlmoco(false); setEditLocal('') }
                          }}>
                            {(Object.entries(TIPO_DIA_LABELS) as [TipoDia,string][]).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        {['trabalho','gozar-horas','outro-local'].includes(editTipo)&&(<>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                            <div><label style={T.label}>Entrada</label><input style={T.input} type="time" value={editEntrada} onChange={e=>setEditEntrada(e.target.value)}/></div>
                            <div><label style={T.label}>Saída</label><input style={T.input} type="time" value={editSaida} onChange={e=>setEditSaida(e.target.value)}/></div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                            <input type="checkbox" id="semAlmoco" checked={editSemAlmoco} onChange={e=>setEditSemAlmoco(e.target.checked)} style={{ width:'15px', height:'15px', flexShrink:0 }}/>
                            <label htmlFor="semAlmoco" style={{ fontSize:'13px', color:theme.text, cursor:'pointer' }}>Sem pausa de almoço (1h)</label>
                          </div>
                        </>)}
                        {editTipo==='outro-local'&&(
                          <div style={{ marginBottom:'10px' }}>
                            <label style={T.label}>Nome do estabelecimento</label>
                            <input style={T.input} type="text" placeholder="Ex: Kaju, Clínica Norte..." value={editLocal} onChange={e=>setEditLocal(e.target.value)}/>
                          </div>
                        )}
                        {['trabalho','gozar-horas','outro-local'].includes(editTipo)&&editEntrada&&editSaida&&(()=>{
                          const mins = calcMinutosTrabalhados({ tipo:editTipo, entrada:editEntrada, saida:editSaida, semAlmoco:editSemAlmoco })
                          const delta = calcDeltaBH({ tipo:editTipo, entrada:editEntrada, saida:editSaida, semAlmoco:editSemAlmoco })
                          return (
                            <div style={{ background:theme.bg, borderRadius:'8px', padding:'8px 12px', marginBottom:'12px', fontSize:'12px', color:theme.textMuted }}>
                              Horas trabalhadas: <strong>{formatHoras(mins)}</strong>
                              {'  ·  '}
                              Banco de horas: <strong style={{ color: delta>=0?'#16a34a':'#dc2626' }}>{delta>=0?'+':''}{formatHoras(Math.abs(delta))}</strong>
                            </div>
                          )
                        })()}
                        <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                          <button onClick={guardarCelula} style={{ flex:1, height:'38px', background:theme.btn, border:'none', borderRadius:'8px', color:theme.btnText, fontSize:'13px', fontWeight:600, cursor:'pointer' }}>Guardar</button>
                          <button onClick={limparCelula} style={{ height:'38px', padding:'0 14px', background:'#fef2f2', border:'none', borderRadius:'8px', color:'#b91c1c', fontSize:'13px', cursor:'pointer' }}>Limpar</button>
                          <button onClick={()=>setEditCelula(null)} style={{ height:'38px', padding:'0 14px', background:theme.bg, border:'1px solid '+theme.border, borderRadius:'8px', color:theme.text, fontSize:'13px', cursor:'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
