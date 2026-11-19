do $outer$
declare body text;
begin
select pg_get_functiondef('public.mt_state()'::regprocedure) into body;
body:=replace(body,'''actor'',a.actor','''actor'',a.actor,''actorName'',(select name from mt.people where id=a.actor)');
execute body;
end $outer$;
