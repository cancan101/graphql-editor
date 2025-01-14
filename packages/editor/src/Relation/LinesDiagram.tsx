import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { fontFamily } from '@/vars';
import { useTreesState } from '@/state/containers/trees';
import { useRelationsState } from '@/state/containers';
import { Node } from './Node';
import styled from '@emotion/styled';
import { sortByConnection } from './Algorithm';
import { Lines, RelationPath } from '@/Relation/Lines';
import { isScalarArgument } from '@/GraphQL/Resolve';
import * as vars from '@/vars';
import { ParserField, getTypeName } from 'graphql-js-tree';
import { useRouter } from '@/state/containers/router';

const Main = styled.div`
  position: relative;
  overflow-x: visible;
  font-family: ${fontFamily};
  align-items: flex-start;
  display: flex;
  padding: 20px;
  gap: 120px;
  flex-wrap: nowrap;
  animation: show 1 0.5s ease-in-out;
  min-height: 100%;
  margin: auto;
  transition: ${vars.transition};

  @keyframes show {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const NodePane = styled.div`
  align-self: center;
  flex-flow: column nowrap;
  margin: auto;
  z-index: 1;
  font-size: 12px;
  align-items: flex-end;
  display: flex;
  padding-bottom: 200px;
`;
let tRefs: Record<string, HTMLDivElement> = {};
let refTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
export type FilteredFieldsTypesProps = {
  fieldsTypes?: string[];
  searchValueEmpty: boolean;
};

const scrollToRef = (fieldName: string): unknown => {
  const ref = tRefs[fieldName];
  if (!ref) {
    return setTimeout(scrollToRef, 10);
  }
  const scrollableArea = ref.parentElement?.parentElement?.parentElement;
  const scrollableAreaHeight = scrollableArea?.offsetHeight || 1;
  const nodeHeight = ref.offsetHeight || 1;
  const top =
    nodeHeight > scrollableAreaHeight / 1.2
      ? scrollableAreaHeight / 4.0
      : scrollableAreaHeight / 2.0 - nodeHeight / 2.0;
  scrollableArea?.scrollTo({
    behavior: 'smooth',
    top: ref.offsetTop - top,
  });
};

type LinesDiagramProps = {
  mainRef: React.RefObject<HTMLDivElement>;
};

export const LinesDiagram: React.FC<LinesDiagramProps> = ({ mainRef }) => {
  const { libraryTree, selectedNode, schemaType, tree, setSelectedNode } =
    useTreesState();
  const { routes } = useRouter();
  const {
    refsLoaded,
    refs,
    setRefs,
    setRefsLoaded,
    setRelationDrawingNodes,
    relationDrawingNodes,
    relationDrawingNodesArray,
    showRelatedTo,
    baseTypesOn,
    enumsOn,
  } = useRelationsState();

  const [filteredFieldsTypes, setFilteredFieldsTypes] = useState<
    Record<string, string>
  >({});
  const [scrolledTo, setScrolledTo] = useState('');
  const [relations, setRelations] =
    useState<
      { to: RelationPath; from: RelationPath[]; fromLength: number }[]
    >();
  useEffect(() => {
    if (scrolledTo == selectedNode?.field?.name) {
      return;
    }
    if (selectedNode?.field && refsLoaded) {
      scrollToRef(selectedNode.field.id);
      setScrolledTo(selectedNode.field.id);
    }
  }, [refsLoaded]);
  useEffect(() => {
    if (!selectedNode) {
      setFilteredFieldsTypes({});
    } else {
      if (selectedNode?.field?.name && refsLoaded) {
        scrollToRef(selectedNode.field.id);
      }
    }
  }, [selectedNode]);

  useEffect(() => {
    setRefsLoaded(false);
    if (selectedNode?.field?.name) {
      const compareNode = {
        ...selectedNode.field,
        args: selectedNode.field.args?.filter((a) =>
          a.name
            .toLowerCase()
            .includes(filteredFieldsTypes['' + selectedNode.field?.id] || ''),
        ),
      };
      const selected = !baseTypesOn
        ? {
            ...selectedNode.field,
            args: selectedNode.field.args?.filter((a) => !isScalarArgument(a)),
          }
        : selectedNode.field;
      const together = tree.nodes.concat(libraryTree.nodes);
      const based = !baseTypesOn
        ? together.map((n) => ({
            ...n,
            args: n.args?.filter((a) => !isScalarArgument(a)),
          }))
        : together;
      const relatedNodes = based
        .filter((n) =>
          compareNode.args?.find(
            (a) => getTypeName(a.type.fieldType) === n.name,
          ),
        )
        .filter((n) => n.name !== selectedNode.field?.name);
      const relatedNames = relatedNodes.map((r) => r.name);
      const relatedToNodes = showRelatedTo
        ? based
            .filter((n) =>
              n.args?.find(
                (arg) =>
                  getTypeName(arg.type.fieldType) === selectedNode.field?.name,
              ),
            )
            .filter((n) => n.name !== selectedNode.field?.name)
            .filter((n) => !relatedNames.includes(n.name))
        : [];
      const resorted = sortByConnection(relatedNodes);
      const resortedRelatedTo = sortByConnection(relatedToNodes);
      setRelationDrawingNodes({
        parent: resortedRelatedTo,
        selected,
        children: resorted,
      });
      return;
    }
  }, [
    selectedNode,
    tree,
    libraryTree,
    filteredFieldsTypes,
    baseTypesOn,
    enumsOn,
    showRelatedTo,
  ]);

  useLayoutEffect(() => {
    if (refsLoaded) {
      setRelations(
        relationDrawingNodesArray
          .map((n) => ({
            to: { htmlNode: refs[n.id], field: n },
            fromLength: n.args?.length || 0,
            from: n.args
              ?.filter((a) =>
                a.name.toLowerCase().includes(filteredFieldsTypes[n.id] || ''),
              )
              .map((a, index) => {
                const pn = relationDrawingNodesArray.find(
                  (nf) => nf.name === getTypeName(a.type.fieldType),
                );
                if (!pn) {
                  return;
                }
                return {
                  htmlNode: refs[pn.id],
                  field: pn,
                  index,
                } as RelationPath;
              })
              .filter((o) => !!o),
          }))
          .filter((n) => n.from)
          .map(
            (n) =>
              n as {
                from: RelationPath[];
                to: RelationPath;
                fromLength: number;
              },
          ),
      );
    }
  }, [refs, relationDrawingNodesArray, refsLoaded]);

  const SvgLinesContainer = useMemo(() => {
    return <Lines relations={relations} selectedNode={selectedNode?.field} />;
  }, [relations]);

  useEffect(() => {
    setRefsLoaded(false);
    setRelations([]);
  }, [routes.code]);

  const NodesContainer = useMemo(() => {
    tRefs = {};
    const libraryNodeNames = libraryTree.nodes.map((l) => l.name);

    const filterNodes = (nodes?: ParserField[]) =>
      nodes
        ? schemaType === 'library'
          ? [...nodes].filter((e) => libraryNodeNames.includes(e.name))
          : [...nodes]
        : [];
    const setRef = (n: ParserField, ref: HTMLDivElement) => {
      tRefs[n.id] = ref;
      const renderedRefs = Object.keys(tRefs).length;
      const length =
        (showRelatedTo ? relationDrawingNodes?.parent.length || 0 : 0) +
        (relationDrawingNodes?.children.length || 0) +
        1;
      if (renderedRefs === length) {
        if (refTimeout) {
          clearTimeout(refTimeout);
        }
        refTimeout = setTimeout(() => {
          setRefs(tRefs);
          setRefsLoaded(true);
        }, 10);
      }
    };
    return (
      <>
        {relationDrawingNodes?.parent.length && (
          <NodePane style={{ alignItems: 'start' }}>
            {filterNodes(relationDrawingNodes?.parent).map((n, i) => (
              <Node
                enums={enumsOn}
                filteredFieldTypes={filteredFieldsTypes[n.id] || ''}
                setFilteredFieldsTypes={(q) =>
                  setFilteredFieldsTypes((ftt) => ({
                    ...ftt,
                    [n.id]: q,
                  }))
                }
                isLibrary={
                  schemaType === 'library'
                    ? true
                    : libraryNodeNames.includes(n.name)
                }
                key={n.id}
                setRef={(ref) => {
                  setRef(n, ref);
                }}
                field={n}
              />
            ))}
          </NodePane>
        )}
        <NodePane style={{ zIndex: 2, alignItems: 'center' }}>
          {relationDrawingNodes?.selected && (
            <Node
              enums={enumsOn}
              filteredFieldTypes={
                filteredFieldsTypes[relationDrawingNodes.selected.id] || ''
              }
              setFilteredFieldsTypes={(q) =>
                setFilteredFieldsTypes((ftt) => ({
                  ...ftt,
                  [relationDrawingNodes.selected.id]: q,
                }))
              }
              isLibrary={
                schemaType === 'library'
                  ? true
                  : libraryNodeNames.includes(
                      relationDrawingNodes.selected.name,
                    )
              }
              key={relationDrawingNodes.selected.id}
              setRef={(ref) => {
                setRef(relationDrawingNodes.selected, ref);
              }}
              field={relationDrawingNodes.selected}
            />
          )}
        </NodePane>
        <NodePane>
          {filterNodes(relationDrawingNodes?.children)
            .sort((a, b) => {
              const aIndex =
                relationDrawingNodes?.selected.args.findIndex(
                  (n) => getTypeName(n.type.fieldType) === a.name,
                ) || -1;
              const bIndex =
                relationDrawingNodes?.selected.args.findIndex(
                  (n) => getTypeName(n.type.fieldType) === b.name,
                ) || -1;

              return aIndex > bIndex ? 1 : -1;
            })
            .map((n, i) => (
              <Node
                enums={enumsOn}
                filteredFieldTypes={filteredFieldsTypes[n.id] || ''}
                setFilteredFieldsTypes={(q) =>
                  setFilteredFieldsTypes((ftt) => ({
                    ...ftt,
                    [n.id]: q,
                  }))
                }
                isLibrary={
                  schemaType === 'library'
                    ? true
                    : libraryNodeNames.includes(n.name)
                }
                key={n.id}
                setRef={(ref) => {
                  setRef(n, ref);
                }}
                field={n}
              />
            ))}
        </NodePane>
      </>
    );
  }, [schemaType, relationDrawingNodes, routes.code]);

  return (
    <Main ref={mainRef} onClick={() => setSelectedNode(undefined)}>
      {NodesContainer}
      {SvgLinesContainer}
    </Main>
  );
};
